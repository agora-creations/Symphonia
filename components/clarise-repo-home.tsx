"use client";

import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  ThreadPrimitive,
  useComposer,
  useComposerRuntime,
  type DataMessagePart,
  type MessageState,
} from "@assistant-ui/react";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/react-ai-sdk";
import type { DataUIPart, UIMessage } from "ai";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Command,
  FileText,
  Landmark,
  ListChecks,
  Loader2,
  Milestone,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ClariseProviderId } from "@/lib/clarise-chat";

type ArtifactResult = {
  kind: string;
  type: string;
  id: string;
  title: string;
  status: string;
  href: string;
};

type ArtifactFailure = {
  artifactKind: string;
  title: string;
  error: string;
};

type ClariseDataTypes = {
  artifact_result: { artifact: ArtifactResult };
  artifact_failure: ArtifactFailure;
  extraction_fallback: { reason: string };
  missing_fields: { fields: { kind: string; field: string }[] };
  tool_call: { name: "create_private_artifact"; artifactKind: string; title: string };
  done: { createdCount: number; failedCount: number };
};

type ClariseUIMessage = UIMessage<unknown, ClariseDataTypes>;

const PROVIDERS: { id: ClariseProviderId; label: string }[] = [
  { id: "codex_app_server", label: "Codex" },
  { id: "claude_code", label: "Claude Code" },
  { id: "gemini", label: "Gemini" },
  { id: "cursor", label: "Cursor" },
];

const SLASH_COMMANDS = [
  {
    command: "/milestone",
    label: "Milestone",
    icon: Milestone,
    prompt: "Create a milestone\nTitle: \nGoal: ",
  },
  {
    command: "/requirement",
    label: "Requirement",
    icon: ListChecks,
    prompt: "Create a requirement\nMilestone: \nTitle: \nRequirement: ",
  },
  {
    command: "/plan",
    label: "Plan",
    icon: FileText,
    prompt: "Create a plan\nMilestone: \nTitle: \nPlan: ",
  },
  {
    command: "/decision",
    label: "Decision",
    icon: Landmark,
    prompt: "Create a decision\nMilestone: \nTitle: \nDecision: ",
  },
  {
    command: "/task-brief",
    label: "Task brief",
    icon: FileText,
    prompt: "Create an execution-ready task brief\nTitle: \nGoal: ",
  },
  {
    command: "/workflow",
    label: "WORKFLOW.md",
    icon: ShieldCheck,
    prompt: "Set up WORKFLOW.md",
  },
];

export function ClariseRepoHome({ repoKey }: { repoKey: string }) {
  const repoSlug = repoKey.toLowerCase();
  const storageKey = `symphonia.clarise.provider.${repoKey}`;
  const router = useRouter();
  const redirectedRef = useRef(false);
  const [provider, setProvider] = useStoredClariseProvider(storageKey);

  const initialMessages = useMemo<ClariseUIMessage[]>(
    () => [
      {
        id: "welcome",
        role: "assistant",
        parts: [
          {
            type: "text",
            text:
              "Start by telling Clarise what you want to build. Clarise will create the private workspace structure for this repository.",
          },
        ],
      },
    ],
    [],
  );

  const transport = useMemo(
    () =>
      new AssistantChatTransport<ClariseUIMessage>({
        api: `/api/repositories/${encodeURIComponent(repoKey)}/clarise/chat`,
        body: { provider },
      }),
    [provider, repoKey],
  );

  const runtime = useChatRuntime<ClariseUIMessage>({
    id: `clarise-${repoKey}`,
    messages: initialMessages,
    transport,
    onData: (part: DataUIPart<ClariseDataTypes>) => {
      if (
        part.type === "data-done" &&
        part.data.createdCount > 0 &&
        !redirectedRef.current
      ) {
        redirectedRef.current = true;
        router.push(`/r/${repoSlug}/workspace?created=private`);
      }
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex min-h-full flex-col bg-background text-foreground">
        <header className="border-b bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-brand-accent-soft text-brand-accent-text">
                  <Sparkles className="h-4 w-4" />
                </span>
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Clarise
                </p>
              </div>
              <h1 className="mt-2 break-words text-[30px] font-bold leading-none sm:text-[42px]">
                {repoKey} repo planning
              </h1>
            </div>

            <label className="flex items-center gap-2 rounded-[8px] border bg-card px-3 py-2 text-[12px] text-muted-foreground">
              Provider
              <select
                value={provider}
                onChange={(event) => setProvider(event.target.value as ClariseProviderId)}
                className="bg-transparent text-[13px] font-medium text-foreground outline-none"
                aria-label="Clarise provider"
              >
                {PROVIDERS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
          <ThreadPrimitive.Viewport className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="mx-auto flex max-w-4xl flex-col gap-4">
              <ThreadPrimitive.Messages>
                {({ message }) => <ClariseMessage key={message.id} message={message} />}
              </ThreadPrimitive.Messages>
            </div>
          </ThreadPrimitive.Viewport>

          <ClariseComposer />
        </ThreadPrimitive.Root>
      </div>
    </AssistantRuntimeProvider>
  );
}

function ClariseMessage({ message }: { message: MessageState }) {
  const isUser = message.role === "user";
  const text = message.content
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("");
  const dataParts = message.content.flatMap((part) =>
    part.type === "data" ? [part as DataMessagePart] : [],
  );
  const artifacts = dataParts.flatMap((part) =>
    part.name === "artifact_result" && isArtifactResultPayload(part.data)
      ? [part.data.artifact]
      : [],
  );
  const failures = dataParts.flatMap((part) =>
    part.name === "artifact_failure" && isArtifactFailure(part.data) ? [part.data] : [],
  );
  const fallback = dataParts.find(
    (part) => part.name === "extraction_fallback" && isFallbackPayload(part.data),
  );
  const missingFields = dataParts.find(
    (part) => part.name === "missing_fields" && isMissingFieldsPayload(part.data),
  );
  const running = message.status?.type === "running";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[min(42rem,100%)] rounded-[10px] px-4 py-3 text-[14px] leading-6",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border bg-card text-foreground shadow-[var(--elevation-card)]",
        )}
      >
        {text && <p className="whitespace-pre-wrap">{text}</p>}

        {running && (
          <div className="mt-3 inline-flex items-center gap-2 text-[12px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Working
          </div>
        )}

        {fallback && isFallbackPayload(fallback.data) && (
          <div className="mt-3 rounded-[8px] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-300">
            Codex extraction fell back to the deterministic parser: {fallback.data.reason}
          </div>
        )}

        {missingFields && isMissingFieldsPayload(missingFields.data) && (
          <div className="mt-3 rounded-[8px] border bg-background/55 px-3 py-2 text-[12px] text-muted-foreground">
            {missingFields.data.fields.map((field) => `${artifactLabel(field.kind)}: ${field.field}`).join("; ")}
          </div>
        )}

        {artifacts.length > 0 && (
          <div className="mt-3 grid gap-2">
            {artifacts.map((artifact) => (
              <ArtifactCard key={`${artifact.type}:${artifact.id}`} artifact={artifact} />
            ))}
          </div>
        )}

        {failures.length > 0 && (
          <div className="mt-3 grid gap-2">
            {failures.map((failure) => (
              <div
                key={`${failure.artifactKind}:${failure.title}`}
                className="rounded-[8px] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-300"
              >
                {failure.title}: {failure.error}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClariseComposer() {
  const composer = useComposerRuntime();
  const text = useComposer((state) => state.text);
  const query = text.startsWith("/") ? text.slice(1).toLowerCase() : "";
  const showMenu = text.startsWith("/");
  const commands = SLASH_COMMANDS.filter((item) => {
    if (!query) return true;
    return (
      item.command.slice(1).includes(query) ||
      item.label.toLowerCase().includes(query)
    );
  });

  return (
    <div className="border-t bg-background/95 px-4 py-4 sm:px-6">
      <div className="relative mx-auto max-w-4xl">
        {showMenu && commands.length > 0 && (
          <div className="absolute bottom-[calc(100%+0.5rem)] left-0 z-10 w-full max-w-md rounded-[8px] border bg-popover p-1 shadow-[var(--elevation-card)]">
            {commands.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.command}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    composer.setText(item.prompt);
                  }}
                  className="flex w-full items-center gap-3 rounded-[6px] px-3 py-2 text-left text-[13px] hover:bg-accent"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-[6px] bg-brand-accent-soft text-brand-accent-text">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-foreground">{item.label}</span>
                    <span className="block text-[12px] text-muted-foreground">{item.command}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <ComposerPrimitive.Root className="flex items-end gap-3 rounded-[10px] border bg-card p-3 shadow-[var(--elevation-card)]">
          <span className="mb-2 grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-background text-muted-foreground">
            <Command className="h-4 w-4" />
          </span>
          <ComposerPrimitive.Input
            rows={2}
            submitMode="enter"
            placeholder="Message Clarise or type / for artifact commands."
            aria-label="Message Clarise"
            className="max-h-40 min-h-[3.5rem] flex-1 resize-none bg-transparent text-[15px] leading-6 outline-none placeholder:text-muted-foreground/60"
          />
          <ComposerPrimitive.Send
            aria-label="Send"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-primary text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Send className="h-4 w-4" />
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
      </div>
    </div>
  );
}

function ArtifactCard({ artifact }: { artifact: ArtifactResult }) {
  return (
    <div className="rounded-[8px] border bg-background/55 p-3">
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-brand-accent-soft text-brand-accent-text">
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[14px] font-semibold">{artifact.title}</h3>
            <span className="rounded-full border border-emerald-500/30 px-2 py-0.5 text-[10px] font-medium uppercase text-emerald-300">
              Private
            </span>
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">{artifactLabel(artifact.kind)}</p>
        </div>
      </div>
      <Link
        href={artifact.href}
        className="mt-3 inline-flex items-center gap-1 rounded-[8px] border px-3 py-1.5 text-[12px] font-medium hover:bg-accent"
      >
        View in workspace
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function useStoredClariseProvider(
  storageKey: string,
): [ClariseProviderId, (provider: ClariseProviderId) => void] {
  const [provider, setProvider] = useState<ClariseProviderId>("codex_app_server");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (
        stored === "codex_app_server" ||
        stored === "claude_code" ||
        stored === "gemini" ||
        stored === "cursor"
      ) {
        setProvider(stored);
      }
    } catch {
      /* ignore */
    }
  }, [setProvider, storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, provider);
    } catch {
      /* ignore */
    }
  }, [provider, storageKey]);

  return [provider, setProvider];
}

function artifactLabel(kind: string): string {
  if (kind === "milestone") return "Milestone";
  if (kind === "requirements") return "Requirement";
  if (kind === "plan") return "Plan";
  if (kind === "decision") return "Decision";
  return "Task brief";
}

function isArtifactResultPayload(value: unknown): value is { artifact: ArtifactResult } {
  return isRecord(value) && isArtifact(value.artifact);
}

function isArtifact(value: unknown): value is ArtifactResult {
  return (
    isRecord(value) &&
    typeof value.kind === "string" &&
    typeof value.type === "string" &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.status === "string" &&
    typeof value.href === "string"
  );
}

function isArtifactFailure(value: unknown): value is ArtifactFailure {
  return (
    isRecord(value) &&
    typeof value.artifactKind === "string" &&
    typeof value.title === "string" &&
    typeof value.error === "string"
  );
}

function isFallbackPayload(value: unknown): value is { reason: string } {
  return isRecord(value) && typeof value.reason === "string";
}

function isMissingFieldsPayload(
  value: unknown,
): value is { fields: { kind: string; field: string }[] } {
  return (
    isRecord(value) &&
    Array.isArray(value.fields) &&
    value.fields.every(
      (field) =>
        isRecord(field) &&
        typeof field.kind === "string" &&
        typeof field.field === "string",
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
