"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  FileText,
  GitBranch,
  Plus,
  ShieldCheck,
  BookOpen,
  Landmark,
  ListChecks,
  MessageSquareText,
  Milestone,
} from "lucide-react";
import type {
  SpecArtifact,
  SpecArtifactStatus,
  SpecArtifactSummary,
  SpecArtifactType,
  SpecWorkspacePayload,
  SpecWorkspaceSection,
} from "@/lib/repository-model";
import { cn } from "@/lib/utils";

interface Props {
  repoKey: string;
}

const SPEC_SECTION_ICONS: Record<string, typeof FileText> = {
  Codebase: BookOpen,
  Milestones: Milestone,
  Discussions: MessageSquareText,
  Requirements: ListChecks,
  Plans: ShieldCheck,
  "Task proposals": ListChecks,
  "Task briefs": FileText,
  Decisions: Landmark,
};

const SPEC_TYPE_LABELS: Record<SpecArtifactType, string> = {
  codebase_map: "Codebase map",
  codebase_conventions: "Conventions",
  codebase_architecture: "Architecture",
  milestone: "Milestone",
  discussion: "Discussion",
  requirements: "Requirement",
  plan: "Plan",
  task_proposal: "Task proposal",
  task_brief: "Task brief",
  decision: "Decision",
};

const SPEC_STATUS_LABELS: Record<SpecArtifactStatus, string> = {
  draft: "Draft",
  in_discussion: "In discussion",
  requirements_ready: "Requirements ready",
  plan_ready: "Plan ready",
  ready_for_approval: "Ready for approval",
  approved: "Approved",
  created: "Created",
  archived: "Archived",
};

/**
 * Notion-like document tree, scoped to one repository.
 *
 * Planning artifacts are shown as private workspace sections. Repository rules
 * are a pinned root link.
 */
export function DocTree({ repoKey }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const slug = repoKey.toLowerCase();
  const [specWorkspace, setSpecWorkspace] = useState<SpecWorkspacePayload | null>(null);
  const [specPending, setSpecPending] = useState<string | null>(null);
  const [specError, setSpecError] = useState<string | null>(null);

  const loadSpecWorkspace = useCallback(async () => {
    const res = await fetch(`/api/repositories/${encodeURIComponent(repoKey)}/spec-workspace`, {
      cache: "no-store",
    });
    const payload = (await res.json()) as {
      specWorkspace?: SpecWorkspacePayload;
      error?: string;
    };
    if (!res.ok || !payload.specWorkspace) {
      throw new Error(payload.error ?? "Could not load planning documents");
    }
    setSpecWorkspace(payload.specWorkspace);
    setSpecError(null);
    return payload.specWorkspace;
  }, [repoKey]);

  useEffect(() => {
    let cancelled = false;
    loadSpecWorkspace().catch((err: unknown) => {
      if (!cancelled) {
        setSpecWorkspace(null);
        setSpecError(err instanceof Error ? err.message : "Could not load planning documents");
      }
    });

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ repoKey: string }>).detail;
      if (detail?.repoKey === repoKey) void loadSpecWorkspace();
    };
    window.addEventListener("symphonia:specWorkspaceChanged", handler as EventListener);

    return () => {
      cancelled = true;
      window.removeEventListener("symphonia:specWorkspaceChanged", handler as EventListener);
    };
  }, [loadSpecWorkspace, repoKey]);

  const initializeSpecWorkspace = async () => {
    setSpecPending("initialize");
    setSpecError(null);
    try {
      const res = await fetch(
        `/api/repositories/${encodeURIComponent(repoKey)}/spec-workspace/initialize`,
        { method: "POST" },
      );
      const payload = (await res.json()) as {
        specWorkspace?: SpecWorkspacePayload;
        error?: string;
      };
      if (!res.ok || !payload.specWorkspace) {
        throw new Error(payload.error ?? "Could not set up planning documents");
      }
      setSpecWorkspace(payload.specWorkspace);
    } catch (err) {
      setSpecError(err instanceof Error ? err.message : "Could not set up planning documents");
    } finally {
      setSpecPending(null);
    }
  };

  const createSpecArtifact = async (kind: "milestones" | "decisions") => {
    setSpecPending(kind);
    setSpecError(null);
    try {
      const res = await fetch(
        `/api/repositories/${encodeURIComponent(repoKey)}/spec-workspace/${kind}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const payload = (await res.json()) as { artifact?: SpecArtifact; error?: string };
      if (!res.ok || !payload.artifact) {
        throw new Error(payload.error ?? "Could not create document");
      }
      await loadSpecWorkspace();
      router.push(specArtifactHref(slug, payload.artifact));
    } catch (err) {
      setSpecError(err instanceof Error ? err.message : "Could not create document");
    } finally {
      setSpecPending(null);
    }
  };

  return (
    <div className="space-y-3 text-[13px]">
      {/* Repository rules are pinned, not a section. */}
      <SidebarLink
        href={`/r/${slug}/workflow`}
        active={pathname === `/r/${slug}/workflow`}
        icon={<GitBranch className="h-3.5 w-3.5" />}
        label="Repository rules"
        right={
          <span className="text-[10px] font-mono text-muted-foreground">root</span>
        }
      />

      {specError && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-300">
          {specError}
        </p>
      )}

      {specWorkspace?.state.initialized ? (
        specWorkspace.sections.map((section) => {
          const Icon = SPEC_SECTION_ICONS[section.label] ?? FileText;
          const onAdd =
            section.label === "Milestones"
              ? () => createSpecArtifact("milestones")
              : section.label === "Decisions"
                ? () => createSpecArtifact("decisions")
                : undefined;

          return (
            <SpecArtifactSection
              key={section.label}
              section={section}
              icon={<Icon className="h-3.5 w-3.5" />}
              repoSlug={slug}
              currentPath={pathname}
              onAdd={onAdd}
              pending={specPending === "milestones" || specPending === "decisions"}
            />
          );
        })
      ) : (
        <div className="rounded-md border border-dashed px-2 py-2">
          <p className="text-[11px] text-muted-foreground">Set up planning documents for this repository.</p>
          <button
            onClick={initializeSpecWorkspace}
            disabled={specPending === "initialize"}
            className="mt-2 rounded-md border bg-background px-2 py-1 text-[11px] hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {specPending === "initialize" ? "Creating..." : "Set up planning docs"}
          </button>
        </div>
      )}

    </div>
  );
}

function SpecArtifactSection({
  section,
  icon,
  repoSlug,
  currentPath,
  onAdd,
  pending,
}: {
  section: SpecWorkspaceSection;
  icon: React.ReactNode;
  repoSlug: string;
  currentPath: string;
  onAdd?: () => void;
  pending?: boolean;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <div className="group flex items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${section.label}`}
          className="grid h-4 w-4 place-items-center rounded hover:bg-accent"
        >
          <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
        </button>
        <div className="flex flex-1 items-center gap-1.5 truncate">
          {icon}
          <span className="truncate">{section.label}</span>
          {section.artifacts.length > 0 && (
            <span className="ml-auto text-[10px] tabular-nums text-muted-foreground/70">
              {section.artifacts.length}
            </span>
          )}
        </div>
        {onAdd && (
          <button
            onClick={onAdd}
            disabled={pending}
            aria-label={`New ${section.label}`}
            title={`New ${section.label.replace(/s$/, "")}`}
            className="grid h-4 w-4 place-items-center rounded opacity-0 group-hover:opacity-100 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>
      {open && (
        <ul className="ml-3 mt-0.5 border-l pl-1.5">
          {section.artifacts.length === 0 ? (
            <li className="px-2 py-1 text-[11px] text-muted-foreground/70">
              Empty{onAdd ? " - click + to add one" : ""}
            </li>
          ) : (
            section.artifacts.map((artifact) => (
              <SpecArtifactNode
                key={`${artifact.type}:${artifact.id}`}
                artifact={artifact}
                repoSlug={repoSlug}
                active={currentPath === specArtifactHref(repoSlug, artifact)}
              />
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function SpecArtifactNode({
  artifact,
  repoSlug,
  active,
}: {
  artifact: SpecArtifactSummary;
  repoSlug: string;
  active: boolean;
}) {
  return (
    <li>
      <Link
        href={specArtifactHref(repoSlug, artifact)}
        className={cn(
          "block rounded-md px-1.5 py-1 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
          active && "bg-sidebar-accent text-sidebar-accent-foreground",
        )}
      >
        <span className="block truncate">
          {artifact.title || (
            <span className="italic text-muted-foreground/70">Untitled</span>
          )}
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground/70">
          <span className="truncate">{SPEC_TYPE_LABELS[artifact.type]}</span>
          <span>{SPEC_STATUS_LABELS[artifact.status]}</span>
        </span>
      </Link>
    </li>
  );
}

function specArtifactHref(
  slug: string,
  artifact: Pick<SpecArtifactSummary, "type" | "id">,
) {
  return `/r/${slug}/workspace/${encodeURIComponent(artifact.type)}/${encodeURIComponent(
    artifact.id,
  )}`;
}

function SidebarLink({
  href,
  active,
  icon,
  label,
  right,
  onClickAction,
  muted,
}: {
  href: string;
  active?: boolean;
  icon: React.ReactNode;
  label: string;
  right?: React.ReactNode;
  onClickAction?: () => void;
  muted?: boolean;
}) {
  const className = cn(
    "flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors",
    active
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : muted
        ? "text-muted-foreground/70 hover:bg-sidebar-accent hover:text-foreground"
        : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
  );
  if (onClickAction) {
    return (
      <button onClick={onClickAction} className={cn(className, "w-full text-left")}>
        {icon}
        <span className="flex-1 truncate">{label}</span>
        {right}
      </button>
    );
  }
  return (
    <Link href={href} className={className}>
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {right}
    </Link>
  );
}
