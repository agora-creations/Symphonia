"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  ExternalLink,
  FolderGit2,
  Github,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type {
  GitHubConnectionState,
  GitHubInstalledRepository,
  RepositorySummary,
} from "@/lib/repository-model";
import { cn } from "@/lib/utils";

const cardShadow =
  "border border-[var(--landing-line)] bg-[var(--landing-paper)] shadow-[0_1px_1px_rgba(37,99,235,0.04)]";

function requestJson<T>(url: string): Promise<T> {
  if (typeof window !== "undefined" && typeof window.fetch === "function") {
    return window.fetch(url, { cache: "no-store" }).then(async (res) => {
      const payload = (await res.json()) as T & { error?: string };
      if (!res.ok) throw new Error(payload.error ?? `Request failed: ${url}`);
      return payload;
    });
  }

  return new Promise<T>((resolve, reject) => {
    if (typeof XMLHttpRequest === "undefined") {
      reject(new Error("Browser request API is unavailable."));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.setRequestHeader("cache-control", "no-store");
    xhr.onload = () => {
      try {
        const payload = JSON.parse(xhr.responseText || "{}") as T & { error?: string };
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(payload.error ?? `Request failed: ${url}`));
          return;
        }
        resolve(payload);
      } catch (err) {
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error(`Request failed: ${url}`));
    xhr.send();
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
  const [githubRepositories, setGitHubRepositories] = useState<GitHubInstalledRepository[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [githubConnection, setGitHubConnection] = useState<GitHubConnectionState | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [openingGitHubRepo, setOpeningGitHubRepo] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<RepositorySummary | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("github") === "installed") {
      setNotice("GitHub connected. Pick a repository to open Clarise and create workspace files.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("github") === "install-canceled") {
      setError("GitHub installation was canceled.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function loadDashboard() {
      try {
        const [repoPayload, connectionPayload, githubRepoPayload] = await Promise.all([
          requestJson<{
            repositories?: RepositorySummary[];
            error?: string;
          }>("/api/repositories"),
          requestJson<{
            connection?: GitHubConnectionState;
            error?: string;
          }>("/api/github/connection").catch(() => null),
          requestJson<{
            repositories?: GitHubInstalledRepository[];
            error?: string;
          }>("/api/github/repositories").catch(() => ({ repositories: [] })),
        ]);

        if (!cancelled) {
          setRepositories(repoPayload.repositories ?? []);
          setGitHubConnection(connectionPayload?.connection ?? null);
          setGitHubRepositories(githubRepoPayload.repositories ?? []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load repositories");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const localGitHubNames = useMemo(() => {
    return new Set(
      repositories
        .map((repo) => {
          if (!repo.github?.owner || !repo.github?.name) return null;
          return `${repo.github.owner}/${repo.github.name}`.toLowerCase();
        })
        .filter((value): value is string => Boolean(value)),
    );
  }, [repositories]);

  const githubOnlyRepositories = useMemo(() => {
    return githubRepositories.filter((repo) => {
      const fullName = (repo.fullName || `${repo.owner}/${repo.name}`).toLowerCase();
      return !localGitHubNames.has(fullName);
    });
  }, [githubRepositories, localGitHubNames]);

  const filteredLocalRepositories = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return repositories;
    return repositories.filter((repo) =>
      `${repo.name} ${repo.key} ${repo.path}`.toLowerCase().includes(q),
    );
  }, [repositories, query]);

  const filteredGitHubRepositories = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return githubOnlyRepositories;
    return githubOnlyRepositories.filter((repo) =>
      `${repo.fullName ?? ""} ${repo.owner} ${repo.name} ${repo.accountLogin ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [githubOnlyRepositories, query]);

  const connectHref = githubConnection?.installationUrl ?? githubConnection?.manageUrl;
  const connectedCount = repositories.length + githubOnlyRepositories.length;
  const hasVisibleRepositories =
    filteredGitHubRepositories.length > 0 || filteredLocalRepositories.length > 0;
  const showEmptyState = !loading && connectedCount === 0;

  const openGitHubConnection = () => {
    if (!connectHref) {
      setError("GitHub connection is unavailable.");
      return;
    }

    window.location.assign(connectHref);
  };

  const confirmRemoval = async () => {
    if (!pendingRemoval) return;
    const repository = pendingRemoval;
    setRemovingKey(repository.key);
    setError(null);

    try {
      const res = await fetch(`/api/repositories/${encodeURIComponent(repository.key)}`, {
        method: "DELETE",
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Could not remove repository");

      setRepositories((current) => current.filter((repo) => repo.key !== repository.key));
      setPendingRemoval(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove repository");
    } finally {
      setRemovingKey(null);
    }
  };

  const openGitHubRepository = async (repository: GitHubInstalledRepository) => {
    const fullName = repository.fullName || `${repository.owner}/${repository.name}`;
    setOpeningGitHubRepo(fullName);
    setError(null);

    try {
      const res = await fetch("/api/github/repositories/workspace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(repository),
      });
      const payload = (await res.json()) as {
        repository?: RepositorySummary;
        error?: string;
      };

      if (!res.ok || !payload.repository) {
        throw new Error(payload.error ?? "Could not open repository");
      }

      const openedRepository = payload.repository;
      setRepositories((current) => {
        const exists = current.some((repo) => repo.key === openedRepository.key);
        return exists ? current : [...current, openedRepository];
      });
      router.push(`/r/${openedRepository.key.toLowerCase()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open repository");
    } finally {
      setOpeningGitHubRepo(null);
    }
  };

  return (
    <div className="landing-page min-h-svh bg-[var(--landing-cream)] text-[var(--landing-ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--landing-line)] bg-[var(--landing-paper)]/92 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-[1180px] items-center justify-between gap-4 px-5 text-[15px] text-[var(--landing-muted)]">
          <Link href="/" className="font-serif text-[30px] font-semibold leading-none text-[var(--landing-ink)]">
            Symphonia
          </Link>
          <div className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--landing-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search repositories"
              aria-label="Search repositories"
              className="h-10 w-64 rounded-full border border-[var(--landing-line)] bg-[var(--landing-cream)] pl-9 pr-3 text-[14px] text-[var(--landing-ink)] outline-none transition focus:border-[var(--landing-blue)] focus:ring-2 focus:ring-[rgba(37,99,235,0.16)]"
            />
          </div>
          <button
            onClick={openGitHubConnection}
            disabled={!connectHref}
            title={!connectHref ? "GitHub connection is unavailable" : "Connect repo"}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-full bg-[var(--landing-blue)] px-5 text-[15px] font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition hover:bg-[var(--landing-blue-dark)]",
              !connectHref && "cursor-not-allowed opacity-55 hover:bg-[var(--landing-blue)]",
            )}
          >
            <Github className="h-4 w-4" />
            Connect repo
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-5 py-10 md:py-14">
        <section className="grid items-center gap-8 border-b border-[var(--landing-line)] pb-10 md:grid-cols-[0.94fr_1.06fr] md:pb-14">
          <div className="relative">
            <p className="text-[13px] font-semibold uppercase text-[var(--landing-blue)]">
              Repository dashboard
            </p>
            <h1 className="mt-4 text-balance text-[44px] font-semibold leading-[0.98] text-[var(--landing-ink)] md:text-[68px]">
              Connect a repo. Clarise creates the workspace files.
            </h1>
            <p className="mt-5 max-w-xl text-[18px] leading-8 text-[var(--landing-muted)]">
              After a repository opens, use Clarise to create your private workspace:
              milestones, requirements, plans, decisions, and task briefs.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                onClick={openGitHubConnection}
                disabled={!connectHref}
                className={cn(
                  "inline-flex h-12 items-center gap-2 rounded-full bg-[var(--landing-blue)] px-6 text-[16px] font-semibold text-white shadow-[0_14px_30px_rgba(37,99,235,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--landing-blue-dark)]",
                  !connectHref && "cursor-not-allowed opacity-55 hover:bg-[var(--landing-blue)]",
                )}
              >
                Connect to GitHub
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="rounded-[8px] border border-[var(--landing-line)] bg-[var(--landing-paper)]">
            <Image
              src="/images/device-stack.png"
              alt="Minimal line illustration of repository workspaces across devices."
              width={1376}
              height={768}
              priority
              className="h-auto w-full"
              sizes="(max-width: 768px) 94vw, 560px"
            />
          </div>
        </section>

        <div className="mt-8 sm:hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--landing-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search repositories"
              aria-label="Search repositories"
              className="h-11 w-full rounded-full border border-[var(--landing-line)] bg-[var(--landing-paper)] pl-9 pr-3 text-[14px] text-[var(--landing-ink)] outline-none transition focus:border-[var(--landing-blue)] focus:ring-2 focus:ring-[rgba(37,99,235,0.16)]"
            />
          </div>
        </div>

        {notice && (
          <div className="mt-6 flex items-center gap-2 rounded-[8px] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-[14px] text-emerald-700">
            <Check className="h-4 w-4" />
            {notice}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-[8px] border border-[rgba(37,99,235,0.24)] bg-[rgba(37,99,235,0.08)] px-4 py-3 text-[14px] text-[var(--landing-blue-dark)]">
            {error}
          </div>
        )}

        <div className="mt-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold uppercase text-[var(--landing-blue)]">
              Workspaces
            </p>
            <h2 className="mt-2 text-[34px] font-semibold leading-none text-[var(--landing-ink)]">
              Repositories
            </h2>
          </div>
          <span className="rounded-full border border-[var(--landing-line)] bg-[var(--landing-paper)] px-3 py-1 text-[13px] font-medium text-[var(--landing-muted)]">
            {connectedCount} connected
          </span>
        </div>

        {loading ? (
          <div
            className={cn(
              "mt-6 rounded-[8px] border-dashed p-10 text-center text-[15px] text-[var(--landing-muted)]",
              cardShadow,
            )}
          >
            Loading repositories...
          </div>
        ) : !hasVisibleRepositories ? (
          <EmptyRepositoryState connectedCount={connectedCount} onConnect={openGitHubConnection} />
        ) : (
          <div className="mt-6 space-y-8">
            {filteredGitHubRepositories.length > 0 && (
              <section>
                <SectionHeader title="GitHub repositories" count={filteredGitHubRepositories.length} />
                <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                  {filteredGitHubRepositories.map((repo) => (
                    <li key={`${repo.installationId}-${repo.fullName ?? `${repo.owner}/${repo.name}`}`}>
                      <GitHubRepositoryCard
                        repository={repo}
                        manageUrl={githubConnection?.manageUrl}
                        opening={openingGitHubRepo === (repo.fullName || `${repo.owner}/${repo.name}`)}
                        onOpen={openGitHubRepository}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {filteredLocalRepositories.length > 0 && (
              <section>
                <SectionHeader title="Local repositories" count={filteredLocalRepositories.length} />
                <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                  {filteredLocalRepositories.map((repo) => (
                    <li key={repo.key}>
                      <RepositoryCard
                        repository={repo}
                        removing={removingKey === repo.key}
                        onRemove={(repository) => setPendingRemoval(repository)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>

      <ConfirmDialog
        open={pendingRemoval != null}
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null);
        }}
        title={pendingRemoval ? `Remove ${pendingRemoval.name}?` : "Remove repository"}
        description={
          <>
            This removes <span className="font-medium text-[var(--landing-ink)]">{pendingRemoval?.name}</span>{" "}
            from Symphonia. Your GitHub repository and local files won&apos;t be affected.
          </>
        }
        confirmLabel={removingKey ? "Removing..." : "Remove"}
        cancelLabel="Cancel"
        destructive
        pending={removingKey != null}
        onConfirm={confirmRemoval}
      />
    </div>
  );
}

function EmptyRepositoryState({
  connectedCount,
  onConnect,
}: {
  connectedCount: number;
  onConnect: () => void;
}) {
  return (
    <div
      className={cn(
        "mt-6 rounded-[8px] p-8 text-center md:p-10",
        cardShadow,
      )}
    >
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-[8px] bg-[var(--landing-soft)] text-[var(--landing-blue)]">
        <FolderGit2 className="h-7 w-7" />
      </div>
      <h3 className="mt-5 text-[28px] font-semibold text-[var(--landing-ink)]">
        {connectedCount > 0 ? "No matching repositories" : "No repositories connected yet"}
      </h3>
      <p className="mx-auto mt-3 max-w-md text-[15px] leading-6 text-[var(--landing-muted)]">
        Connect GitHub to bring your repositories into Symphonia. Once a repo is opened,
        Clarise becomes the first stop for creating the editable workspace files.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onConnect}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--landing-blue)] px-4 text-[15px] font-semibold text-white transition hover:bg-[var(--landing-blue-dark)]"
        >
          <Github className="h-4 w-4" />
          Connect to GitHub
        </button>
        <button
          disabled
          title="Coming soon - demo repositories are on the way."
          className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-full border border-[var(--landing-line)] bg-[var(--landing-paper)] px-4 text-[15px] font-medium text-[var(--landing-muted)]"
        >
          <Sparkles className="h-4 w-4" />
          Demo repository
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-[17px] font-semibold text-[var(--landing-ink)]">{title}</h3>
      <span className="text-[13px] tabular-nums text-[var(--landing-muted)]">{count}</span>
    </div>
  );
}

function GitHubRepositoryCard({
  repository,
  manageUrl,
  opening,
  onOpen,
}: {
  repository: GitHubInstalledRepository;
  manageUrl?: string;
  opening: boolean;
  onOpen: (repository: GitHubInstalledRepository) => void;
}) {
  const fullName = repository.fullName || `${repository.owner}/${repository.name}`;
  const openWorkspace = () => {
    if (!opening) onOpen(repository);
  };
  const openFromKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openWorkspace();
  };

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`Open ${fullName} repository`}
      aria-busy={opening}
      onClick={openWorkspace}
      onKeyDown={openFromKeyboard}
      className={cn(
        "group cursor-pointer rounded-[8px] p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[var(--landing-blue)] focus:outline-none focus:ring-2 focus:ring-[rgba(37,99,235,0.18)]",
        cardShadow,
        opening && "cursor-wait opacity-75",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-[8px] bg-[var(--landing-soft)] text-[var(--landing-blue)]">
          <Github className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-[17px] font-semibold text-[var(--landing-ink)]">
            {fullName}
          </h4>
          <p className="truncate text-[13px] text-[var(--landing-muted)]">
            Open in Clarise to create workspace files
            {repository.defaultBranch ? ` / ${repository.defaultBranch}` : ""}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-[var(--landing-muted)] transition-colors group-hover:text-[var(--landing-ink)]" />
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
        <Stat label="Repo" value={opening ? "Opening" : "Connected"} />
        <Stat label="Workspace" value="Needs Clarise" muted />
        <Stat label="Account" value={repository.accountLogin ?? repository.owner} />
      </dl>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--landing-blue)]">
          {opening ? "Opening Clarise..." : "Open Clarise"}
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
        <div className="relative z-10 flex items-center gap-3">
          {repository.url && (
            <a
              href={repository.url}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              className="inline-flex items-center gap-1 text-[13px] text-[var(--landing-muted)] hover:text-[var(--landing-ink)]"
            >
              GitHub
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {manageUrl && (
            <a
              href={manageUrl}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              className="inline-flex items-center gap-1 text-[13px] text-[var(--landing-muted)] hover:text-[var(--landing-ink)]"
            >
              Repos
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function RepositoryCard({
  repository,
  removing,
  onRemove,
}: {
  repository: RepositorySummary;
  removing: boolean;
  onRemove: (repository: RepositorySummary) => void;
}) {
  const workspace = repository.workspace;
  const files = workspace?.initialized ? "Ready" : "Missing";
  const rules = workspace?.workflow.exists ? "Ready" : "Missing";
  const href = `/r/${repository.key.toLowerCase()}`;
  const workspaceReady = workspace?.initialized && workspace.workflow.exists;

  return (
    <div
      className={cn(
        "group relative rounded-[8px] p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--landing-blue)]",
        cardShadow,
      )}
    >
      <Link
        href={href}
        aria-label={`Open ${repository.name} repository`}
        className="absolute inset-0 z-10 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[rgba(37,99,235,0.18)]"
      />
      <div className="flex items-center gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] bg-[var(--landing-soft)] text-[15px] font-semibold text-[var(--landing-blue)]"
        >
          {repository.key[0]}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-[17px] font-semibold text-[var(--landing-ink)]">
            {repository.name}
          </h4>
          <p className="truncate text-[13px] text-[var(--landing-muted)]">
            {repository.github?.owner && repository.github?.name
              ? `${repository.github.owner}/${repository.github.name}`
              : "Local repository"}
          </p>
          <p className="mt-1 truncate text-[12px] text-[var(--landing-muted)]">
            {workspaceReady
              ? "Workspace files are ready to edit"
              : "Use Clarise to create workspace files"}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-[var(--landing-muted)] transition-colors group-hover:text-[var(--landing-ink)]" />
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
        <Stat label="Start" value={workspaceReady ? "Workspace" : "Clarise"} />
        <Stat label="Files" value={files} muted={!workspace?.initialized} />
        <Stat label="Rules" value={rules} muted={!workspace?.workflow.exists} />
      </dl>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--landing-blue)]">
          {workspaceReady ? "Open repo" : "Open Clarise"}
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
        <button
          type="button"
          onClick={() => onRemove(repository)}
          disabled={removing}
          className="relative z-20 inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-[var(--landing-line)] px-3 text-[12px] font-medium text-[var(--landing-muted)] transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Remove ${repository.name} from Symphonia`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {removing ? "Removing" : "Remove"}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-[8px] bg-[var(--landing-soft)] px-2 py-2">
      <dt className="text-[10px] font-semibold uppercase text-[var(--landing-muted)]">
        {label}
      </dt>
      <dd className={cn("truncate text-[14px] font-semibold tabular-nums text-[var(--landing-ink)]", muted && "text-[var(--landing-blue)]")}>
        {value}
      </dd>
    </div>
  );
}
