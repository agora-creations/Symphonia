"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  ChevronRight,
  FileText,
  GitBranch,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type {
  SpecArtifactStatus,
  SpecArtifactSummary,
  SpecArtifactType,
  SpecWorkspacePayload,
  SpecWorkspaceSection,
} from "@/lib/repository-model";
import { useDocs, type DocPage } from "@/lib/docs-store";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Props {
  repoKey: string;
}

const WORKSPACE_GROUPS = [
  { label: "Codebase", sectionLabels: ["Codebase"] },
  {
    label: "Milestone",
    sectionLabels: ["Milestones", "Discussions", "Requirements", "Task proposals"],
  },
  { label: "Plans", sectionLabels: ["Plans"] },
  { label: "Decisions", sectionLabels: ["Decisions"] },
];

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
  const pathname = usePathname();
  const router = useRouter();
  const slug = repoKey.toLowerCase();
  const {
    archivedForRepo,
    archivePage,
    createPage,
    deletePage,
    forRepo,
    hydrated,
    restorePage,
  } = useDocs();
  const [specWorkspace, setSpecWorkspace] = useState<SpecWorkspacePayload | null>(null);
  const [specPending, setSpecPending] = useState<string | null>(null);
  const [specError, setSpecError] = useState<string | null>(null);
  const [pagePending, setPagePending] = useState<string | null>(null);

  const docPages = useMemo(
    () =>
      forRepo(repoKey)
        .filter((page) => page.category === "doc")
        .sort((a, b) => a.createdAt - b.createdAt),
    [forRepo, repoKey],
  );
  const archivedDocPages = useMemo(
    () =>
      archivedForRepo(repoKey)
        .filter((page) => page.category === "doc")
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [archivedForRepo, repoKey],
  );

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

  const createUntitledPage = async (parentId?: string) => {
    const pendingKey = `create:${parentId ?? "root"}`;
    setPagePending(pendingKey);
    try {
      const page = await createPage(repoKey, "doc", {
        title: "Untitled",
        body: "",
        parentId,
      });
      router.push(`/r/${slug}/docs/${encodeURIComponent(page.id)}`);
    } finally {
      setPagePending(null);
    }
  };

  const archiveDocPage = async (page: DocPage) => {
    setPagePending(`archive:${page.id}`);
    try {
      await archivePage(page.id);
      if (pathname === `/r/${slug}/docs/${page.id}`) {
        router.push(`/r/${slug}/docs`);
      }
    } finally {
      setPagePending(null);
    }
  };

  const restoreDocPage = async (page: DocPage) => {
    setPagePending(`restore:${page.id}`);
    try {
      await restorePage(page.id);
    } finally {
      setPagePending(null);
    }
  };

  const permanentlyDeleteDocPage = async (page: DocPage) => {
    setPagePending(`delete:${page.id}`);
    try {
      await deletePage(page.id);
    } finally {
      setPagePending(null);
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

      <PageTreeSection
        repoSlug={slug}
        currentPath={pathname}
        pages={docPages}
        archivedPages={archivedDocPages}
        hydrated={hydrated}
        pending={pagePending}
        onCreate={createUntitledPage}
        onArchive={archiveDocPage}
        onRestore={restoreDocPage}
        onPermanentDelete={permanentlyDeleteDocPage}
      />

      {specError && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-300">
          {specError}
        </p>
      )}

      {specWorkspace?.state.initialized ? (
        <div className="space-y-2">
          {WORKSPACE_GROUPS.map((group) => {
            const artifacts = group.sectionLabels.flatMap(
              (label) =>
                specWorkspace.sections.find((section) => section.label === label)?.artifacts ?? [],
            );

            return (
              <SpecArtifactSection
                key={group.label}
                label={group.label}
                artifacts={artifacts}
                repoSlug={slug}
                currentPath={pathname}
              />
            );
          })}
        </div>
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

function PageTreeSection({
  repoSlug,
  currentPath,
  pages,
  archivedPages,
  hydrated,
  pending,
  onCreate,
  onArchive,
  onRestore,
  onPermanentDelete,
}: {
  repoSlug: string;
  currentPath: string;
  pages: DocPage[];
  archivedPages: DocPage[];
  hydrated: boolean;
  pending: string | null;
  onCreate: (parentId?: string) => Promise<void>;
  onArchive: (page: DocPage) => Promise<void>;
  onRestore: (page: DocPage) => Promise<void>;
  onPermanentDelete: (page: DocPage) => Promise<void>;
}) {
  const { childrenByParent, rootPages } = useMemo(() => {
    const ids = new Set(pages.map((page) => page.id));
    const grouped = new Map<string, DocPage[]>();

    for (const page of pages) {
      const parentKey = page.parentId && ids.has(page.parentId) ? page.parentId : "root";
      const children = grouped.get(parentKey) ?? [];
      children.push(page);
      grouped.set(parentKey, children);
    }

    for (const children of grouped.values()) {
      children.sort((a, b) => a.createdAt - b.createdAt);
    }

    return {
      childrenByParent: grouped,
      rootPages: grouped.get("root") ?? [],
    };
  }, [pages]);

  return (
    <section className="space-y-1">
      <div className="flex items-center justify-between gap-1 px-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Pages
        </span>
        <div className="flex items-center gap-0.5">
          <TrashMenu
            pages={archivedPages}
            pending={pending}
            onRestore={onRestore}
            onPermanentDelete={onPermanentDelete}
          />
          <button
            type="button"
            onClick={() => void onCreate()}
            disabled={pending === "create:root"}
            aria-label="New page"
            title="New page"
            className="grid h-6 w-6 place-items-center rounded-[8px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!hydrated ? (
        <div className="px-1.5 py-1 text-[12px] text-muted-foreground">Loading pages...</div>
      ) : rootPages.length === 0 ? (
        <button
          type="button"
          onClick={() => void onCreate()}
          disabled={pending === "create:root"}
          className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FileText className="h-3.5 w-3.5" />
          <span className="flex-1 truncate">Add a page</span>
        </button>
      ) : (
        <ul className="space-y-0.5">
          {rootPages.map((page) => (
            <PageTreeNode
              key={page.id}
              page={page}
              repoSlug={repoSlug}
              currentPath={currentPath}
              childrenByParent={childrenByParent}
              pending={pending}
              depth={0}
              onCreate={onCreate}
              onArchive={onArchive}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function PageTreeNode({
  page,
  repoSlug,
  currentPath,
  childrenByParent,
  pending,
  depth,
  onCreate,
  onArchive,
}: {
  page: DocPage;
  repoSlug: string;
  currentPath: string;
  childrenByParent: Map<string, DocPage[]>;
  pending: string | null;
  depth: number;
  onCreate: (parentId?: string) => Promise<void>;
  onArchive: (page: DocPage) => Promise<void>;
}) {
  const href = pageHref(repoSlug, page);
  const children = childrenByParent.get(page.id) ?? [];
  const hasChildren = children.length > 0;
  const active = currentPath === href;
  const activeDescendant = hasActiveDescendant(children, childrenByParent, currentPath, repoSlug);
  const [open, setOpen] = useState(activeDescendant);

  useEffect(() => {
    if (activeDescendant) setOpen(true);
  }, [activeDescendant]);

  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-0.5 rounded-md pr-1 transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
        )}
        style={{ paddingLeft: `${depth * 12 + 2}px` }}
      >
        <button
          type="button"
          onClick={() => hasChildren && setOpen((value) => !value)}
          disabled={!hasChildren}
          aria-label={open ? "Collapse page" : "Expand page"}
          className={cn(
            "grid h-6 w-4 place-items-center rounded text-muted-foreground",
            hasChildren ? "hover:text-foreground" : "opacity-0",
          )}
        >
          <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
        </button>
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-1.5 py-1">
          <PageIcon page={page} />
          <span className="truncate">
            {page.title || <span className="italic text-muted-foreground/70">Untitled</span>}
          </span>
        </Link>
        <button
          type="button"
          onClick={() => void onCreate(page.id)}
          disabled={pending === `create:${page.id}`}
          aria-label={`Add page inside ${page.title || "Untitled"}`}
          title="Add page inside"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-[8px] text-muted-foreground opacity-0 transition hover:bg-background/70 hover:text-foreground group-hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Page actions for ${page.title || "Untitled"}`}
              title="Page actions"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-[8px] text-muted-foreground opacity-0 transition hover:bg-background/70 hover:text-foreground group-hover:opacity-100 focus:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-44 p-1">
            <button
              type="button"
              onClick={() => void onArchive(page)}
              disabled={pending === `archive:${page.id}`}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Archive className="h-3.5 w-3.5" />
              Delete
            </button>
          </PopoverContent>
        </Popover>
      </div>

      {hasChildren && open && (
        <ul className="mt-0.5 space-y-0.5">
          {children.map((child) => (
            <PageTreeNode
              key={child.id}
              page={child}
              repoSlug={repoSlug}
              currentPath={currentPath}
              childrenByParent={childrenByParent}
              pending={pending}
              depth={depth + 1}
              onCreate={onCreate}
              onArchive={onArchive}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function TrashMenu({
  pages,
  pending,
  onRestore,
  onPermanentDelete,
}: {
  pages: DocPage[];
  pending: string | null;
  onRestore: (page: DocPage) => Promise<void>;
  onPermanentDelete: (page: DocPage) => Promise<void>;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Open trash"
          title="Trash"
          className="flex h-6 items-center gap-1 rounded-[8px] px-1 text-[11px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {pages.length > 0 && <span className="tabular-nums">{pages.length}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Trash
        </div>
        {pages.length === 0 ? (
          <p className="px-1 py-2 text-[12px] text-muted-foreground">Trash is empty.</p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {pages.map((page) => (
              <li key={page.id} className="rounded-md border bg-background/60 p-1.5">
                <div className="flex min-w-0 items-center gap-2">
                  <PageIcon page={page} />
                  <span className="min-w-0 flex-1 truncate text-[12px]">
                    {page.title || (
                      <span className="italic text-muted-foreground/70">Untitled</span>
                    )}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => void onRestore(page)}
                    disabled={pending === `restore:${page.id}`}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => void onPermanentDelete(page)}
                    disabled={pending === `delete:${page.id}`}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-red-600 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete forever
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function PageIcon({ page }: { page: DocPage }) {
  if (page.icon) return <span className="shrink-0 text-sm leading-none">{page.icon}</span>;
  return <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
}

function pageHref(repoSlug: string, page: DocPage) {
  return `/r/${repoSlug}/docs/${encodeURIComponent(page.id)}`;
}

function hasActiveDescendant(
  pages: DocPage[],
  childrenByParent: Map<string, DocPage[]>,
  currentPath: string,
  repoSlug: string,
): boolean {
  return pages.some((page) => {
    if (currentPath === pageHref(repoSlug, page)) return true;
    return hasActiveDescendant(childrenByParent.get(page.id) ?? [], childrenByParent, currentPath, repoSlug);
  });
}

function SpecArtifactSection({
  label,
  artifacts,
  repoSlug,
  currentPath,
}: {
  label: string;
  artifacts: SpecWorkspaceSection["artifacts"];
  repoSlug: string;
  currentPath: string;
}) {
  const hasActiveArtifact = artifacts.some(
    (artifact) => currentPath === specArtifactHref(repoSlug, artifact),
  );
  const [open, setOpen] = useState(hasActiveArtifact);

  useEffect(() => {
    if (hasActiveArtifact) setOpen(true);
  }, [hasActiveArtifact]);

  if (artifacts.length === 0) return null;

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
          hasActiveArtifact && "text-foreground",
        )}
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
        <span className="flex-1 truncate">{label}</span>
        <span className="text-[10px] tabular-nums text-muted-foreground/70">
          {artifacts.length}
        </span>
      </button>
      {open && (
        <ul className="mt-1 border-l pl-1.5">
          {artifacts.map((artifact) => (
            <SpecArtifactNode
              key={`${artifact.type}:${artifact.id}`}
              artifact={artifact}
              repoSlug={repoSlug}
              active={currentPath === specArtifactHref(repoSlug, artifact)}
            />
          ))}
        </ul>
      )}
    </section>
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
