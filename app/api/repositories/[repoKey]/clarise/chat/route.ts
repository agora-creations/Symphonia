import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { NextResponse } from "next/server";
import {
  normalizeClarisePlan,
  normalizeClariseProvider,
  planClariseResponse,
  type ClariseArtifactDraft,
  type ClariseChatMessage,
  type ClarisePlan,
  type ClariseProviderId,
} from "@/lib/clarise-chat";
import { serviceJson } from "@/lib/server/symphonia-service";

export const runtime = "nodejs";

type ServiceArtifact = {
  type: string;
  id: string;
  title: string;
  status: string;
  path: string;
};

type ServiceArtifactResponse = {
  artifact: ServiceArtifact;
};

type ServiceExtractionResponse = {
  source?: string;
  plan?: unknown;
};

type ArtifactResult = {
  kind: string;
  type: string;
  id: string;
  title: string;
  status: string;
  href: string;
};

type ClariseDataTypes = {
  artifact_result: { artifact: ArtifactResult };
  artifact_failure: { artifactKind: string; title: string; error: string };
  extraction_fallback: { reason: string };
  missing_fields: { fields: { kind: string; field: string }[] };
  tool_call: { name: "create_private_artifact"; artifactKind: string; title: string };
  done: { createdCount: number; failedCount: number };
};

type ClariseUIMessage = UIMessage<unknown, ClariseDataTypes>;

const PROVIDERS: Record<
  ClariseProviderId,
  { label: string; connected: () => boolean; setup: string }
> = {
  codex_app_server: {
    label: "Codex",
    connected: () => true,
    setup: "/settings",
  },
  claude_code: {
    label: "Claude Code",
    connected: () => process.env.SYMPHONIA_CLAUDE_CODE_CONNECTED === "true",
    setup: "/settings",
  },
  gemini: {
    label: "Gemini",
    connected: () => process.env.SYMPHONIA_GEMINI_CONNECTED === "true",
    setup: "/settings",
  },
  cursor: {
    label: "Cursor",
    connected: () => process.env.SYMPHONIA_CURSOR_CONNECTED === "true",
    setup: "/settings",
  },
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ repoKey: string }> },
) {
  const { repoKey } = await params;
  const payload = (await request.json().catch(() => ({}))) as {
    provider?: unknown;
    messages?: UIMessage[];
  };
  const provider = normalizeClariseProvider(payload.provider);
  const providerConfig = PROVIDERS[provider];

  if (!providerConfig.connected()) {
    return NextResponse.json(
      {
        code: "provider_not_connected",
        error: `${providerConfig.label} is not connected.`,
        provider,
        providerSetupHref: `/r/${repoKey.toLowerCase()}${providerConfig.setup}`,
      },
      { status: 409 },
    );
  }

  const messages = uiMessagesToClarise(payload.messages);
  const extraction = await extractPlanWithCodex(repoKey, messages);

  const stream = createUIMessageStream<ClariseUIMessage>({
    execute: async ({ writer }) => {
      let createdCount = 0;
      let failedCount = 0;
      let batchMilestoneId: string | undefined;
      const textId = "clarise-response";

      writer.write({ type: "start" });
      writer.write({ type: "text-start", id: textId });
      writer.write({ type: "text-delta", id: textId, delta: extraction.plan.assistantText });
      writer.write({ type: "text-end", id: textId });

      if (extraction.fallbackReason) {
        writer.write({
          type: "data-extraction_fallback",
          id: "clarise-extraction-fallback",
          data: { reason: extraction.fallbackReason },
        });
      }

      if (extraction.plan.missingFields.length > 0) {
        writer.write({
          type: "data-missing_fields",
          id: "clarise-missing-fields",
          data: { fields: extraction.plan.missingFields },
        });
      }

      for (const draft of extraction.plan.artifactDrafts) {
        writer.write({
          type: "data-tool_call",
          id: `tool-${draft.kind}-${draft.title}`,
          data: {
            name: "create_private_artifact",
            artifactKind: draft.kind,
            title: draft.title,
          },
        });

        try {
          const artifact = await createPrivateArtifact(repoKey, provider, draft, batchMilestoneId);
          if (draft.kind === "milestone") batchMilestoneId = artifact.id;
          createdCount += 1;
          writer.write({
            type: "data-artifact_result",
            id: `artifact-${artifact.type}-${artifact.id}`,
            data: {
              artifact: {
                kind: draft.kind,
                type: artifact.type,
                id: artifact.id,
                title: artifact.title,
                status: artifact.status,
                href: `/r/${repoKey.toLowerCase()}/workspace/${encodeURIComponent(
                  artifact.type,
                )}/${encodeURIComponent(artifact.id)}`,
              },
            },
          });
        } catch (error) {
          failedCount += 1;
          writer.write({
            type: "data-artifact_failure",
            id: `artifact-failure-${draft.kind}-${draft.title}`,
            data: {
              artifactKind: draft.kind,
              title: draft.title,
              error: error instanceof Error ? error.message : "Could not create artifact.",
            },
          });
        }
      }

      writer.write({
        type: "data-done",
        id: "clarise-done",
        data: { createdCount, failedCount },
      });
      writer.write({ type: "finish", finishReason: "stop" });
    },
  });

  return createUIMessageStreamResponse({
    stream,
    headers: { "cache-control": "no-store" },
  });
}

async function extractPlanWithCodex(
  repoKey: string,
  messages: ClariseChatMessage[],
): Promise<{ plan: ClarisePlan; fallbackReason?: string }> {
  try {
    const response = await serviceJson<ServiceExtractionResponse>(
      `/api/repositories/${encodeURIComponent(repoKey)}/clarise/extract`,
      {
        method: "POST",
        body: JSON.stringify({ messages }),
      },
    );
    const plan = normalizeClarisePlan(response.plan);
    if (!plan) throw new Error("Codex returned an unusable artifact plan.");
    return { plan };
  } catch (error) {
    return {
      plan: planClariseResponse(messages),
      fallbackReason:
        error instanceof Error ? error.message : "Codex artifact extraction failed.",
    };
  }
}

async function createPrivateArtifact(
  repoKey: string,
  provider: ClariseProviderId,
  draft: ClariseArtifactDraft,
  batchMilestoneId?: string,
): Promise<ServiceArtifact> {
  if (draft.linkToBatchMilestone && !batchMilestoneId) {
    throw new Error("Parent milestone was not created.");
  }

  const relatedMilestone =
    draft.parentMilestoneId ?? (draft.linkToBatchMilestone ? batchMilestoneId : undefined);
  const endpoint = endpointForKind(draft.kind);
  const payload = await serviceJson<ServiceArtifactResponse>(
    `/api/repositories/${encodeURIComponent(repoKey)}/spec-workspace/${endpoint}`,
    {
      method: "POST",
      body: JSON.stringify({
        ...draft.metadata,
        provider,
        related_milestone: relatedMilestone,
        title: draft.title,
        body: draft.body,
      }),
    },
  );

  return payload.artifact;
}

function uiMessagesToClarise(messages: unknown): ClariseChatMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages.flatMap((message): ClariseChatMessage[] => {
    if (!isRecord(message)) return [];
    const role = message.role === "assistant" ? "assistant" : "user";
    const content = messageContent(message);
    return content ? [{ role, content }] : [];
  });
}

function messageContent(message: Record<string, unknown>): string {
  if (typeof message.content === "string") return message.content.trim();
  const parts = Array.isArray(message.parts) ? message.parts : [];
  return parts
    .flatMap((part) => {
      if (!isRecord(part)) return [];
      return part.type === "text" && typeof part.text === "string" ? [part.text] : [];
    })
    .join("\n")
    .trim();
}

function endpointForKind(kind: ClariseArtifactDraft["kind"]): string {
  switch (kind) {
    case "milestone":
      return "milestones";
    case "requirements":
      return "requirements";
    case "plan":
      return "plans";
    case "decision":
      return "decisions";
    case "task_brief":
      return "task-briefs";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
