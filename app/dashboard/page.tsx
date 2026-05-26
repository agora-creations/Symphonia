"use client";

import Link from "next/link";
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
  "shadow-[0_1px_1px_rgba(0,0,0,0.12),0_0_0_1px_rgba(61,59,53,0.16),0_3px_9px_rgba(61,59,53,0.08)]";

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
      setNotice("GitHub connected. Pick a repository to open its workspace.");
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
      router.push(`/r/${openedRepository.key.toLowerCase()}/tasks`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open repository");
    } finally {
      setOpeningGitHubRepo(null);
    }
  };

  return (
    <div className="min-h-svh bg-[#f7f5ef] text-[#27251f]">
      <header className="sticky top-0 z-20 flex h-[60px] items-center justify-between border-b border-[#ebe6de] bg-white px-5 text-[15px] text-[#37352f]">
        <Link href="/" className="font-serif text-[28px] font-black tracking-[-0.06em] text-black">
          symphonia*
        </Link>
        <div className="flex items-center gap-3">
          <div className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c8780]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search repositories"
              aria-label="Search repositories"
              className="h-9 w-56 rounded-lg border border-[#ded8cf] bg-[#fffdf8] pl-9 pr-3 text-[14px] text-[#37352f] outline-none transition focus:border-[#0070d7] focus:ring-2 focus:ring-[#0070d7]/20"
            />
          </div>
          <button
            onClick={openGitHubConnection}
            disabled={!connectHref}
            title={!connectHref ? "GitHub connection is unavailable" : "Connect repo"}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg bg-[#0070d7] px-4 text-[15px] font-medium text-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] transition hover:bg-[#005fbb]",
              !connectHref && "cursor-not-allowed opacity-55 hover:bg-[#0070d7]",
            )}
          >
            <Github className="h-4 w-4" />
            Connect repo
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[976px] px-5 py-10 md:py-14">
        <section className="relative overflow-hidden rounded-[10px] bg-black px-6 py-10 text-white shadow-[0_18px_60px_rgba(0,0,0,0.18)] md:px-10 md:py-12">
          <div className="absolute left-8 top-8 h-1.5 w-24 rotate-[-3deg] rounded-full bg-[#f81ce5] shadow-[0_0_18px_rgba(248,28,229,0.8)]" />
          <div className="absolute right-12 top-16 hidden rounded-[50%] border-[4px] border-[#5a5a5a] px-6 py-3 text-[28px] font-bold italic tracking-[-0.06em] text-[#5a5a5a] md:block">
            ship
          </div>
          <div className="relative max-w-2xl">
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#8c8780]">
              Repository dashboard
            </p>
            <h1 className="mt-4 text-balance text-[42px] font-bold leading-[1] tracking-[-0.045em] md:text-[58px]">
              Connect the codebase before the agents start.
            </h1>
            <p className="mt-4 max-w-xl text-[17px] leading-7 text-[#aaa7a0]">
              Pick a GitHub repository or open an existing local workspace.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                onClick={openGitHubConnection}
                disabled={!connectHref}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-lg bg-[#0070d7] px-4 text-[15px] font-semibold text-white transition hover:bg-[#005fbb]",
                  !connectHref && "cursor-not-allowed opacity-55 hover:bg-[#0070d7]",
                )}
              >
                Connect to GitHub
                <ArrowRight className="h-4 w-4" />
              </button>
              <span className="text-[13px] text-[#6a6861]">{connectedCount} connected</span>
            </div>
          </div>
        </section>

        <div className="mt-8 sm:hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c8780]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search repositories"
              aria-label="Search repositories"
              className="h-10 w-full rounded-lg border border-[#ded8cf] bg-white pl-9 pr-3 text-[14px] text-[#37352f] outline-none transition focus:border-[#0070d7] focus:ring-2 focus:ring-[#0070d7]/20"
            />
          </div>
        </div>

        {notice && (
          <div className="mt-6 flex items-center gap-2 rounded-[10px] border border-[#b8e1c6] bg-[#effaf3] px-4 py-3 text-[14px] text-[#176d3a]">
            <Check className="h-4 w-4" />
            {notice}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-[10px] border border-[#f0c06f] bg-[#fff5df] px-4 py-3 text-[14px] text-[#8b5a00]">
            {error}
          </div>
        )}

        <div className="mt-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#8c8780]">
              Workspaces
            </p>
            <h2 className="mt-2 text-[34px] font-bold leading-none tracking-[-0.045em] text-black">
              Repositories
            </h2>
          </div>
          <span className="rounded-full border border-[#ded8cf] bg-white px-3 py-1 text-[13px] font-medium text-[#6a6861]">
            {connectedCount} connected
          </span>
        </div>

        {loading ? (
          <div
            className={cn(
              "mt-6 rounded-[10px] border border-dashed border-[#d7d0c7] bg-white p-10 text-center text-[15px] text-[#6a6861]",
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
            This removes <span className="font-medium text-foreground">{pendingRemoval?.name}</span>{" "}
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
        "mt-6 rounded-[10px] bg-[#fefefe] p-8 text-center md:p-10",
        cardShadow,
      )}
    >
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-[10px] bg-[#f7f5ef] text-[#0070d7]">
        <FolderGit2 className="h-7 w-7" />
      </div>
      <h3 className="mt-5 text-[28px] font-bold tracking-[-0.04em] text-black">
        {connectedCount > 0 ? "No matching repositories" : "No repositories connected yet"}
      </h3>
      <p className="mx-auto mt-3 max-w-md text-[15px] leading-6 text-[#6a6861]">
        Connect GitHub to bring your repositories into Symphonia. Once a repo is
        opened, the existing tasks, docs, reviews, and workspace pages take over.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onConnect}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0070d7] px-4 text-[15px] font-semibold text-white transition hover:bg-[#005fbb]"
        >
          <Github className="h-4 w-4" />
          Connect to GitHub
        </button>
        <button
          disabled
          title="Coming soon - demo repositories are on the way."
          className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-lg border border-[#ded8cf] bg-white px-4 text-[15px] font-medium text-[#8c8780]"
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
      <h3 className="text-[17px] font-bold tracking-[-0.025em] text-black">{title}</h3>
      <span className="text-[13px] tabular-nums text-[#8c8780]">{count}</span>
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
        "group cursor-pointer rounded-[10px] bg-[#fefefe] p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_1px_1px_rgba(0,0,0,0.12),0_0_0_1px_rgba(61,59,53,0.16),0_12px_28px_rgba(61,59,53,0.16)] focus:outline-none focus:ring-2 focus:ring-[#0070d7]/30",
        cardShadow,
        opening && "cursor-wait opacity-75",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-[9px] bg-[#f7f5ef] text-[#0070d7]">
          <Github className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-[17px] font-bold tracking-[-0.025em] text-black">
            {fullName}
          </h4>
          <p className="truncate text-[13px] text-[#77746c]">
            Connected on GitHub
            {repository.defaultBranch ? ` / ${repository.defaultBranch}` : ""}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-[#8c8780] transition-colors group-hover:text-black" />
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
        <Stat label="Status" value={opening ? "Opening" : "Connected"} />
        <Stat label="Account" value={repository.accountLogin ?? repository.owner} />
        <Stat label="Branch" value={repository.defaultBranch ?? "-"} />
      </dl>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[#0070d7]">
          {opening ? "Opening workspace..." : "Open workspace"}
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
              className="inline-flex items-center gap-1 text-[13px] text-[#77746c] hover:text-black"
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
              className="inline-flex items-center gap-1 text-[13px] text-[#77746c] hover:text-black"
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
  const href = `/r/${repository.key.toLowerCase()}/tasks`;

  return (
    <div
      className={cn(
        "group relative rounded-[10px] bg-[#fefefe] p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_1px_1px_rgba(0,0,0,0.12),0_0_0_1px_rgba(61,59,53,0.16),0_12px_28px_rgba(61,59,53,0.16)]",
        cardShadow,
      )}
    >
      <Link
        href={href}
        aria-label={`Open ${repository.name} repository`}
        className="absolute inset-0 z-10 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#0070d7]/30"
      />
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-[9px] bg-[#f7f5ef] text-[15px] font-bold",
            colorForRepo(repository.key),
          )}
        >
          {repository.key[0]}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-[17px] font-bold tracking-[-0.025em] text-black">
            {repository.name}
          </h4>
          <p className="truncate text-[13px] text-[#77746c]">
            {repository.github?.owner && repository.github?.name
              ? `${repository.github.owner}/${repository.github.name}`
              : "Local repository"}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-[#8c8780] transition-colors group-hover:text-black" />
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
        <Stat label="Tasks" value={String(repository.taskCount ?? 0)} />
        <Stat label="Files" value={files} muted={!workspace?.initialized} />
        <Stat label="Rules" value={rules} muted={!workspace?.workflow.exists} />
      </dl>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => onRemove(repository)}
          disabled={removing}
          className="relative z-20 inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[#ded8cf] bg-white px-3 text-[12px] font-medium text-[#77746c] transition hover:border-[#d04437]/30 hover:bg-[#fff0ee] hover:text-[#b42318] disabled:cursor-not-allowed disabled:opacity-50"
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
    <div className="rounded-lg bg-[#f7f5ef] px-2 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8c8780]">
        {label}
      </dt>
      <dd className={cn("truncate text-[14px] font-bold tabular-nums text-black", muted && "text-[#ad6a00]")}>
        {value}
      </dd>
    </div>
  );
}

function colorForRepo(key: string): string {
  const colors = ["text-[#e5484d]", "text-[#0070d7]", "text-[#8f47ff]", "text-[#168b4a]"];
  return colors[key.charCodeAt(0) % colors.length] ?? colors[0];
}
