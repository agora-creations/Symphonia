"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MarkdownPage } from "@/lib/repository-model";

/**
 * Notion-like document store for Symphonía.
 *
 * Every durable workspace object (Task brief, Project page, Doc, Decision,
 * Review, Run Summary, plus root repository rules) lives here as a Markdown-backed
 * page with a stable repo file path. Paths follow the configurable doc root:
 *
 *   symphonia/projects/<id>.md
 *   symphonia/tasks/<key>.md
 *   symphonia/docs/<slug>.md  (can be nested)
 *   symphonia/decisions/<slug>.md
 *   symphonia/reviews/<slug>.md
 *   symphonia/run-summaries/<slug>.md
 *
 * Workflow is the single exception and lives at the repository root.
 *
 * Local-first: pages are kept in React state and mirrored to localStorage so
 * the prototype survives reloads. The "repository file" is the conceptual
 * source of truth — the store models that contract.
 */

export type DocCategory =
  | "task"
  | "project"
  | "doc"
  | "decision"
  | "review"
  | "run-summary"
  | "workflow";

export interface DocPage {
  id: string;
  repo: string;
  category: DocCategory;
  /** Repo-relative file path, e.g. "symphonia/docs/architecture.md". */
  path: string;
  title: string;
  body: string;
  icon?: string; // emoji
  cover?: string; // gradient id
  parentId?: string;
  archived?: boolean;
  published?: boolean;
  /** Free-form linked sources for tasks (URLs, issue refs). */
  links?: string[];
  /** Task-specific metadata, opaque to the editor. */
  meta?: Record<string, string | number | boolean | undefined>;
  createdAt: number;
  updatedAt: number;
}

export const CATEGORY_LABELS: Record<DocCategory, string> = {
  task: "Tasks",
  project: "Projects",
  doc: "Docs",
  decision: "Decisions",
  review: "Reviews",
  "run-summary": "Run Summaries",
  workflow: "Repository rules",
};

export const CATEGORY_SINGULAR: Record<DocCategory, string> = {
  task: "Task",
  project: "Project",
  doc: "Doc",
  decision: "Decision",
  review: "Review",
  "run-summary": "Run Summary",
  workflow: "Repository rules",
};

export const COVERS = [
  { id: "sunset", className: "bg-gradient-to-br from-amber-300 via-rose-400 to-fuchsia-500" },
  { id: "ocean", className: "bg-gradient-to-br from-sky-400 via-cyan-500 to-emerald-500" },
  { id: "forest", className: "bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600" },
  { id: "violet", className: "bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500" },
  { id: "graphite", className: "bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-900" },
  { id: "paper", className: "bg-gradient-to-br from-stone-200 via-stone-100 to-amber-100" },
];

export const COMMON_ICONS = [
  "📄", "📘", "📝", "🧭", "🗺️", "🏗️", "🎯", "🧩", "⚙️", "🔒",
  "🚀", "🔭", "🪲", "✨", "🧪", "📐", "🛠️", "🧱", "📊", "🪪",
];

const STORAGE_KEY = "symphonia.docs.v1";

function pathFor(category: DocCategory, slug: string): string {
  if (category === "workflow") return "Repository rules";
  const folder: Record<Exclude<DocCategory, "workflow">, string> = {
    task: "symphonia/tasks",
    project: "symphonia/projects",
    doc: "symphonia/docs",
    decision: "symphonia/decisions",
    review: "symphonia/reviews",
    "run-summary": "symphonia/run-summaries",
  };
  return `${folder[category as Exclude<DocCategory, "workflow">]}/${slug}.md`;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled"
  );
}

function uid(prefix = "p") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

/* ---------- Seed pages ---------- */

function buildSeed(): DocPage[] {
  const now = Date.now();
  const repos = ["SYM", "API", "WEB", "OPS"];
  const seeds: DocPage[] = [];

  for (const repo of repos) {
    seeds.push({
      id: uid("wf"),
      repo,
      category: "workflow",
      path: "WORKFLOW" + ".md",
      title: "Repository rules",
      icon: "🧭",
      body:
        "# Repository rules\n# Simple PR — Clarise runs, opens a PR, human reviews on GitHub.\n\non_task_started:\n  - assign: clarise\n  - require_pr: true\n\non_run_complete:\n  - status: in_review\n  - notify_assignees: true\n\non_pr_merged:\n  - status: completed\n",
      createdAt: now,
      updatedAt: now,
    });

    if (repo === "SYM") {
      const archId = uid("doc");
      seeds.push({
        id: archId,
        repo,
        category: "doc",
        path: "symphonia/docs/architecture.md",
        title: "Architecture",
        icon: "🏗️",
        cover: "graphite",
        body:
          "# Architecture\n\nSymphonía is a Notion-like workspace backed by repositories. " +
          "Every durable object — Task, Project, Doc, Decision, Review, Run Summary, plus " +
          "root repository rules — is canonical Markdown in the repository.\n\n" +
          "## What you are looking at\n\nThis page is a long-form doc in the workspace. " +
          "It edits as Markdown and saves back to `symphonia/docs/architecture.md`.\n\n" +
          "## Why it matters\n\nDocuments are the system of record. GitHub and Linear " +
          "issues are linked projections, never the canonical Task object.\n",
        createdAt: now,
        updatedAt: now,
      });
      seeds.push({
        id: uid("doc"),
        repo,
        category: "doc",
        path: "symphonia/docs/architecture/editor.md",
        title: "Editor model",
        icon: "📝",
        parentId: archId,
        body:
          "# Editor model\n\nThe editor is intentionally Markdown-first. Title, body, " +
          "icon, and cover are stored on the page. Pages can nest. The repository file " +
          "is the source of truth.\n",
        createdAt: now,
        updatedAt: now,
      });
      seeds.push({
        id: uid("doc"),
        repo,
        category: "doc",
        path: "symphonia/docs/onboarding.md",
        title: "Onboarding",
        icon: "🧭",
        cover: "ocean",
        body:
          "# Onboarding\n\nWelcome to Symphonía. This doc walks new contributors through " +
          "the workspace.\n\n- Open Tasks to see work on a board.\n" +
          "- Use Cmd+K (or Ctrl+K) to jump anywhere.\n- Ask Clarise from the bottom-right " +
          "if you want a draft started for you.\n",
        createdAt: now,
        updatedAt: now,
      });
      seeds.push({
        id: uid("dec"),
        repo,
        category: "decision",
        path: "symphonia/decisions/2026-05-markdown-source-of-truth.md",
        title: "Markdown is the source of truth",
        icon: "🪪",
        body:
          "# Markdown is the source of truth\n\n**Status:** Accepted\n\n**Decision.** Tasks, " +
          "Projects, Docs, Decisions, Reviews and Run Summaries are stored as Markdown in " +
          "the repository. GitHub/Linear issues are linked projections only.\n\n" +
          "**Why.** Repo-backed Markdown is durable, diffable, reviewable in PRs, and " +
          "portable across tools.\n",
        createdAt: now,
        updatedAt: now,
      });
      seeds.push({
        id: uid("rev"),
        repo,
        category: "review",
        path: "symphonia/reviews/2026-05-19-overview-redesign.md",
        title: "Tasks redesign - review notes",
        icon: "🔭",
        body:
          "# Tasks redesign - review notes\n\n- Board is the right default; remembering " +
          "the chosen mode per repository feels good.\n- Empty status columns should still " +
          "render so the structure is visible.\n- Card density needs another pass for very " +
          "long titles.\n",
        createdAt: now,
        updatedAt: now,
      });
      seeds.push({
        id: uid("run"),
        repo,
        category: "run-summary",
        path: "symphonia/run-summaries/2026-05-21-clarise-task-cards.md",
        title: "Clarise run - task card density",
        icon: "🚀",
        body:
          "# Clarise run - task card density\n\n**Assistant:** Clarise\n\n" +
          "**Files changed:** 4\n\n**Summary.** Tightened card padding, switched to " +
          "tabular numerals for IDs, and added a 2-line clamp on titles.\n\n" +
          "**Validation.** Tests passed. Lint clean.\n",
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return seeds;
}

/* ---------- Context ---------- */

interface DocsState {
  pages: DocPage[];
  /** Pages that are open as editable drafts but not yet saved. */
  drafts: DocPage[];
  /** True once the store has loaded any persisted pages from localStorage. */
  hydrated: boolean;
  byId: (id: string) => DocPage | undefined;
  byPath: (repo: string, path: string) => DocPage | undefined;
  forRepo: (repo: string) => DocPage[];
  archivedForRepo: (repo: string) => DocPage[];
  /** Open a fresh draft for a category (used by "New …" actions). */
  newDraft: (
    repo: string,
    category: DocCategory,
    init?: Partial<Pick<DocPage, "title" | "body" | "icon" | "parentId" | "links" | "meta">>,
  ) => DocPage;
  /** Create a saved page directly (no draft step). Used to promote mock data. */
  createPage: (
    repo: string,
    category: DocCategory,
    init: Partial<Pick<DocPage, "title" | "body" | "icon" | "parentId" | "links" | "meta">>,
  ) => Promise<DocPage>;
  updateDraft: (id: string, patch: Partial<DocPage>) => void;
  saveDraft: (
    id: string,
    patch?: Partial<Pick<DocPage, "title" | "body" | "icon" | "cover" | "published">>,
  ) => Promise<DocPage | undefined>;
  discardDraft: (id: string) => void;
  updatePage: (id: string, patch: Partial<DocPage>) => void;
  archivePage: (id: string) => Promise<void>;
  restorePage: (id: string) => Promise<void>;
  deletePage: (id: string) => Promise<void>;
  ensureWorkflow: (repo: string) => DocPage;
}

const Ctx = createContext<DocsState | null>(null);

export function DocsProvider({ children, repoKey }: { children: ReactNode; repoKey?: string }) {
  const [pages, setPages] = useState<DocPage[]>([]);
  const [drafts, setDrafts] = useState<DocPage[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage, then replace doc pages with the repo-backed API
  // when the local service is available.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setHydrated(false);
      const localPages = loadLocalPages();
      if (cancelled) return;
      setPages(localPages);

      if (repoKey) {
        try {
          const servicePages = await fetchMarkdownPages(repoKey, { includeArchived: true });
          if (!cancelled) {
            setPages((current) => mergeServiceDocPages(current, repoKey, servicePages, true));
          }
        } catch {
          // Keep local pages when the Elixir service is unavailable.
        }
      }

      if (!cancelled) setHydrated(true);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [repoKey]);

  // Persist on change.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
    } catch {
      /* ignore quota errors */
    }
  }, [pages, hydrated]);

  const byId = useCallback(
    (id: string) => pages.find((p) => p.id === id) ?? drafts.find((p) => p.id === id),
    [pages, drafts],
  );
  const byPath = useCallback(
    (repo: string, path: string) =>
      pages.find((p) => p.repo === repo && p.path === path && !p.archived),
    [pages],
  );
  const forRepo = useCallback(
    (repo: string) => pages.filter((p) => p.repo === repo && !p.archived),
    [pages],
  );
  const archivedForRepo = useCallback(
    (repo: string) => pages.filter((p) => p.repo === repo && p.archived),
    [pages],
  );

  const newDraft = useCallback<DocsState["newDraft"]>((repo, category, init) => {
    const now = Date.now();
    const draft: DocPage = {
      id: uid("draft"),
      repo,
      category,
      path: pathFor(category, slugify(init?.title ?? "untitled")),
      title: init?.title ?? "",
      body: init?.body ?? "",
      icon: init?.icon,
      parentId: init?.parentId,
      links: init?.links,
      meta: init?.meta,
      createdAt: now,
      updatedAt: now,
    };
    setDrafts((d) => [...d, draft]);
    return draft;
  }, []);

  const createPage: DocsState["createPage"] = useCallback(
    async (repo, category, init) => {
      const now = Date.now();
      const page: DocPage = {
        id: uid("page"),
        repo,
        category,
        path: pathFor(category, slugify(init.title ?? "untitled")),
        title: init.title ?? "",
        body: init.body ?? "",
        icon: init.icon,
        parentId: init.parentId,
        links: init.links,
        meta: init.meta,
        createdAt: now,
        updatedAt: now,
      };

      if (repoKey && repo === repoKey && category === "doc") {
        try {
          const saved = await createServiceDocPage(repoKey, page);
          setPages((p) => mergeServiceDocPages(p, repoKey, [saved]));
          return saved;
        } catch {
          // Fall through to local creation so the UI remains usable offline.
        }
      }

      setPages((p) => [...p, page]);
      return page;
    },
    [repoKey],
  );

  const updateDraft: DocsState["updateDraft"] = useCallback((id, patch) => {
    setDrafts((d) =>
      d.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)),
    );
  }, []);

  const saveDraft: DocsState["saveDraft"] = useCallback(
    async (id, patch) => {
      const found = drafts.find((p) => p.id === id);
      if (!found) return undefined;
      const latest = { ...found, ...patch, updatedAt: Date.now() };

      if (repoKey && latest.category === "doc") {
        try {
          const saved = await createServiceDocPage(repoKey, latest);
          setDrafts((d) => d.filter((p) => p.id !== id));
          setPages((p) => mergeServiceDocPages(p, repoKey, [saved]));
          return saved;
        } catch {
          // Fall through to local save so drafting remains usable without the service.
        }
      }

      const path = pathFor(latest.category, slugify(latest.title || "untitled"));
      const saved = { ...latest, path, updatedAt: Date.now() };
      setDrafts((d) => d.filter((p) => p.id !== id));
      setPages((p) => [...p, saved]);
      return saved;
    },
    [drafts, repoKey],
  );

  const discardDraft: DocsState["discardDraft"] = useCallback((id) => {
    setDrafts((d) => d.filter((p) => p.id !== id));
  }, []);

  const updatePage: DocsState["updatePage"] = useCallback(
    (id, patch) => {
      const existing = pages.find((page) => page.id === id);
      setPages((p) =>
        p.map((page) => (page.id === id ? { ...page, ...patch, updatedAt: Date.now() } : page)),
      );
      setDrafts((d) =>
        d.map((page) => (page.id === id ? { ...page, ...patch, updatedAt: Date.now() } : page)),
      );

      if (repoKey && existing?.category === "doc") {
        const optimistic = { ...existing, ...patch, updatedAt: Date.now() };
        void updateServiceDocPage(repoKey, optimistic).then((saved) => {
          setPages((current) =>
            current.map((page) => (page.id === saved.id ? saved : page)),
          );
        }).catch(() => {
          /* local state remains the offline fallback */
        });
      }
    },
    [pages, repoKey],
  );

  const archivePage: DocsState["archivePage"] = useCallback(
    async (id) => {
      const existing = pages.find((page) => page.id === id);
      if (!existing) return;
      setPages((current) =>
        current.map((page) =>
          page.id === id ? { ...page, archived: true, updatedAt: Date.now() } : page,
        ),
      );

      if (repoKey && existing.repo === repoKey && existing.category === "doc") {
        try {
          const saved = await archiveServiceDocPage(repoKey, id);
          setPages((current) => current.map((page) => (page.id === saved.id ? saved : page)));
        } catch {
          /* local state remains the offline fallback */
        }
      }
    },
    [pages, repoKey],
  );

  const restorePage: DocsState["restorePage"] = useCallback(
    async (id) => {
      const existing = pages.find((page) => page.id === id);
      if (!existing) return;
      setPages((current) =>
        current.map((page) =>
          page.id === id ? { ...page, archived: false, updatedAt: Date.now() } : page,
        ),
      );

      if (repoKey && existing.repo === repoKey && existing.category === "doc") {
        try {
          const saved = await updateServiceDocPage(repoKey, { ...existing, archived: false });
          setPages((current) => current.map((page) => (page.id === saved.id ? saved : page)));
        } catch {
          /* local state remains the offline fallback */
        }
      }
    },
    [pages, repoKey],
  );

  const deletePage: DocsState["deletePage"] = useCallback(
    async (id) => {
      const existing = pages.find((page) => page.id === id);
      if (!existing) return;
      setPages((current) => current.filter((page) => page.id !== id));

      if (repoKey && existing.repo === repoKey && existing.category === "doc") {
        try {
          await deleteServiceDocPage(repoKey, id);
        } catch {
          /* local state remains the offline fallback */
        }
      }
    },
    [pages, repoKey],
  );

  const ensureWorkflow: DocsState["ensureWorkflow"] = useCallback(
    (repo) => {
      const existing = pages.find((p) => p.repo === repo && p.category === "workflow");
      if (existing) return existing;
      const now = Date.now();
      const created: DocPage = {
        id: uid("wf"),
        repo,
        category: "workflow",
        path: "WORKFLOW" + ".md",
        title: "Repository rules",
        icon: "🧭",
        body: "",
        createdAt: now,
        updatedAt: now,
      };
      setPages((p) => [...p, created]);
      return created;
    },
    [pages],
  );

  const value = useMemo<DocsState>(
    () => ({
      pages,
      drafts,
      hydrated,
      byId,
      byPath,
      forRepo,
      archivedForRepo,
      newDraft,
      createPage,
      updateDraft,
      saveDraft,
      discardDraft,
      updatePage,
      archivePage,
      restorePage,
      deletePage,
      ensureWorkflow,
    }),
    [
      pages,
      drafts,
      hydrated,
      byId,
      byPath,
      forRepo,
      archivedForRepo,
      newDraft,
      createPage,
      updateDraft,
      saveDraft,
      discardDraft,
      updatePage,
      archivePage,
      restorePage,
      deletePage,
      ensureWorkflow,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDocs(): DocsState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDocs must be used inside <DocsProvider>");
  return v;
}

export { pathFor, slugify };

function loadLocalPages(): DocPage[] {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (raw) return JSON.parse(raw) as DocPage[];
  } catch {
    /* ignore malformed local cache */
  }
  return buildSeed();
}

async function fetchMarkdownPages(
  repoKey: string,
  opts: { includeArchived?: boolean } = {},
): Promise<DocPage[]> {
  const query = opts.includeArchived ? "?includeArchived=true" : "";
  const res = await fetch(`/api/repositories/${encodeURIComponent(repoKey)}/pages${query}`, {
    cache: "no-store",
  });
  const payload = (await res.json()) as { pages?: MarkdownPage[]; error?: string };
  if (!res.ok || !payload.pages) {
    throw new Error(payload.error ?? "Could not load pages");
  }
  return payload.pages.map((page) => fromServicePage(repoKey, page));
}

async function createServiceDocPage(repoKey: string, draft: DocPage): Promise<DocPage> {
  const res = await fetch(`/api/repositories/${encodeURIComponent(repoKey)}/pages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(toServicePayload(draft)),
  });
  const payload = (await res.json()) as { page?: MarkdownPage; error?: string };
  if (!res.ok || !payload.page) {
    throw new Error(payload.error ?? "Could not save page");
  }
  return fromServicePage(repoKey, payload.page);
}

async function updateServiceDocPage(repoKey: string, page: DocPage): Promise<DocPage> {
  const res = await fetch(
    `/api/repositories/${encodeURIComponent(repoKey)}/pages/${encodeURIComponent(page.id)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(toServicePayload(page)),
    },
  );
  const payload = (await res.json()) as { page?: MarkdownPage; error?: string };
  if (!res.ok || !payload.page) {
    throw new Error(payload.error ?? "Could not update page");
  }
  return fromServicePage(repoKey, payload.page);
}

async function archiveServiceDocPage(repoKey: string, id: string): Promise<DocPage> {
  const res = await fetch(
    `/api/repositories/${encodeURIComponent(repoKey)}/pages/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  const payload = (await res.json()) as { page?: MarkdownPage; error?: string };
  if (!res.ok || !payload.page) {
    throw new Error(payload.error ?? "Could not archive page");
  }
  return fromServicePage(repoKey, payload.page);
}

async function deleteServiceDocPage(repoKey: string, id: string): Promise<void> {
  const res = await fetch(
    `/api/repositories/${encodeURIComponent(repoKey)}/pages/${encodeURIComponent(
      id,
    )}?permanent=true`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Could not delete page");
  }
}

function mergeServiceDocPages(
  current: DocPage[],
  repoKey: string,
  servicePages: DocPage[],
  replaceRepoDocs = false,
) {
  const serviceIds = new Set(servicePages.map((page) => page.id));
  const kept = current.filter((page) => {
    if (page.repo !== repoKey || page.category !== "doc") return true;
    if (replaceRepoDocs) return false;
    return !serviceIds.has(page.id);
  });
  return [...kept, ...servicePages].sort((a, b) => b.updatedAt - a.updatedAt);
}

function fromServicePage(repoKey: string, page: MarkdownPage): DocPage {
  return {
    id: page.id,
    repo: repoKey,
    category: "doc",
    path: page.path,
    title: page.title,
    body: page.body,
    icon: page.icon,
    cover: page.cover,
    parentId: page.parentId,
    archived: page.isArchived,
    published: page.isPublished,
    createdAt: timestamp(page.createdAt),
    updatedAt: timestamp(page.updatedAt),
  };
}

function toServicePayload(page: DocPage) {
  return {
    title: page.title || "Untitled",
    body: page.body,
    parentId: page.parentId,
    icon: page.icon,
    cover: page.cover,
    isArchived: page.archived,
    isPublished: page.published,
  };
}

function timestamp(value?: string): number {
  if (!value) return Date.now();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}
