export type RunnerMode = "local_service" | "remote_runner";
export type RunnerStatus = "online" | "offline" | "stale" | "disabled";
export type RunnerTrustState = "local_service" | "pending" | "trusted" | "disabled" | "revoked";
export type RunnerHealthState = "online" | "offline" | "stale";
export type RunnerTokenState = "active" | "rotated" | "revoked";

export interface RunnerCapabilities {
  codexAppServer: boolean;
  localGitWorktree: boolean;
  experimentalSandbox: boolean;
  validation: boolean;
}

export interface RunnerLimits {
  maxConcurrentRuns: number;
}

export interface RunnerStatusRow {
  id: string;
  name: string;
  mode: RunnerMode;
  status: RunnerStatus;
  trustState?: RunnerTrustState;
  healthState?: RunnerHealthState;
  tokenState?: RunnerTokenState;
  requiresTokenRotation?: boolean;
  lastHeartbeatAt?: string;
  capabilities: RunnerCapabilities;
  limits: RunnerLimits;
  currentRuns: number;
}

export type RunnerTone = "ready" | "warning" | "blocked" | "neutral";

export function runnerStatusLabel(runner: RunnerStatusRow): string {
  if (runner.trustState === "pending") return "Pending approval";
  if (runner.trustState === "revoked") return "Revoked";
  if (runner.trustState === "disabled") return "Disabled";
  if (runner.tokenState === "rotated") return "Token rotation required";
  if (runner.status === "online") {
    if (runner.mode === "remote_runner" && runner.trustState === "trusted") return "Trusted · Online";
    if (runner.mode === "remote_runner") return "Online · Experimental";
    if (runner.trustState === "local_service") return "Trusted built-in · Online";
    return "Online";
  }
  if (runner.status === "stale") return "Stale";
  if (runner.status === "offline") return "Offline";
  if (runner.status === "disabled") return "Disabled";
  return "Unknown";
}

export function runnerStatusTone(runner: RunnerStatusRow): RunnerTone {
  if (runner.trustState === "revoked") return "blocked";
  if (runner.trustState === "pending") return "warning";
  if (runner.trustState === "disabled") return "neutral";
  if (runner.tokenState === "rotated" || runner.tokenState === "revoked") return "blocked";
  if (runner.status === "disabled") return "neutral";
  if (runner.status === "offline") return "blocked";
  if (runner.status === "stale") return "warning";
  if (runner.mode === "remote_runner") return "warning";
  if (runner.capabilities.codexAppServer) return "ready";
  return "warning";
}

export function runnerCapabilitySummary(runner: RunnerStatusRow): string {
  const capabilities = [
    runner.capabilities.codexAppServer ? "Codex ready" : null,
    runner.capabilities.localGitWorktree ? "Local Git worktree" : null,
    runner.capabilities.experimentalSandbox ? "Experimental sandbox" : null,
    runner.capabilities.validation ? "Validation ready" : null,
  ].filter((value): value is string => Boolean(value));

  return capabilities.length > 0 ? capabilities.join(" · ") : "No runner capabilities";
}

export function runnerTrustDetail(runner: RunnerStatusRow): string {
  if (runner.trustState === "pending") {
    return "Runner is connected but cannot execute until an owner approves it.";
  }
  if (runner.trustState === "trusted") {
    return "Runner may execute only for repositories that explicitly allow it.";
  }
  if (runner.trustState === "revoked") {
    return "Runner credentials are no longer accepted.";
  }
  if (runner.trustState === "disabled") {
    return "Runner is disabled and cannot be selected.";
  }
  return runner.mode === "local_service"
    ? "Built-in local service runner."
    : "Runner trust state is not available.";
}

export function runnerCapacityLabel(runner: RunnerStatusRow): string {
  return `${Math.max(0, runner.currentRuns)} / ${Math.max(1, runner.limits.maxConcurrentRuns)}`;
}

export function canSelectRunnerForHarness(runner: RunnerStatusRow): boolean {
  return (
    runner.mode === "local_service" &&
    runner.status === "online" &&
    runner.capabilities.codexAppServer &&
    runner.currentRuns < runner.limits.maxConcurrentRuns
  );
}
