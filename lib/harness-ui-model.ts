import type {
  CodingAssistantRun,
  CodingAssistantRunEvent,
  ServiceTask,
  TaskEligibilityExplanation,
  ValidationEvidence,
} from "@/lib/task-model";
import type { RepositoryAutomationState } from "@/lib/repository-model";

export interface HarnessStatusBadge {
  label: string;
  reason?: string;
  tone: "ready" | "warning" | "neutral";
}

export interface CompactRunBadge {
  label: "Working" | "Checking changes" | "Ready for review" | "Failed" | "Canceled";
  tone: "neutral" | "ready" | "warning";
}

export interface ReviewHandoffView {
  summary?: string;
  files: string[];
  nextReviewAction?: string;
  branch?: string;
  curatedSummaryPath?: string;
  validationEvidence: ValidationEvidence[];
  proofNeeded: string[];
}

export type ReviewGateState =
  | "needs_review"
  | "approved_ready_for_pr"
  | "pr_open"
  | "pr_merged"
  | "pr_closed"
  | "changes_requested"
  | "not_reviewable";

export function automationLabel(automation?: RepositoryAutomationState | null): string {
  return automation?.enabled ? "Automation on" : "Automation off";
}

export function harnessLabel(automation?: RepositoryAutomationState | null): string {
  return automation?.enabled ? "Automation on" : "Automation off";
}

export function daemonLabel(daemon?: { running?: boolean } | null): string {
  return daemon?.running ? "Background service: Active" : "Background service: Stopped";
}

export function isActiveRun(run?: CodingAssistantRun | null): boolean {
  return run?.state === "queued" || run?.state === "running";
}

export function activeRunPollingTarget(task?: Pick<ServiceTask, "run"> | null): string | null {
  return isActiveRun(task?.run) && task?.run?.id ? task.run.id : null;
}

export function runOriginLabel(run?: CodingAssistantRun | null): string {
  switch (run?.kind) {
    case "assignment":
      return "Manual";
    case "daemon_assignment":
      return "Harness";
    case "review_continuation":
      return "Review continuation";
    default:
      return "Unknown";
  }
}

export function compactRunBadge(run?: CodingAssistantRun | null): CompactRunBadge | null {
  if (!run) return null;

  if (run.state === "completed") return { label: "Ready for review", tone: "ready" };
  if (run.state === "failed") return { label: "Failed", tone: "warning" };
  if (run.state === "canceled") return { label: "Canceled", tone: "warning" };

  const step = run.displayStep ?? run.currentStep ?? "";
  if (step.includes("Checking") || step.includes("Detecting") || step.includes("Creating")) {
    return { label: "Checking changes", tone: "neutral" };
  }

  return { label: "Working", tone: "neutral" };
}

export function terminalRunStateLabel(run?: CodingAssistantRun | null): string | undefined {
  if (run?.state === "completed") return "Completed";
  if (run?.state === "failed") return "Failed";
  if (run?.state === "canceled") return "Canceled";
  return undefined;
}

export function isReviewReady(task: ServiceTask): boolean {
  return task.status === "in_review" && Boolean(task.handoff);
}

export function reviewGateState(task: ServiceTask): ReviewGateState {
  if (task.status === "completed" && task.githubPrState === "merged") {
    return "pr_merged";
  }

  if (task.status === "in_review" && task.githubPrState === "open") {
    return "pr_open";
  }

  if (task.status === "in_review" && task.githubPrState === "closed") {
    return "pr_closed";
  }

  if (task.status === "in_review" && task.reviewApproved && task.handoff) {
    return "approved_ready_for_pr";
  }

  if (task.status === "in_review" && task.handoff) {
    return "needs_review";
  }

  if (task.status === "in_progress" && task.run?.kind === "review_continuation") {
    return "changes_requested";
  }

  return "not_reviewable";
}

export function reviewGateLabel(task: ServiceTask): string {
  switch (reviewGateState(task)) {
    case "needs_review":
      return "Needs review";
    case "approved_ready_for_pr":
      return "Approved - ready to open PR";
    case "pr_open":
      return "PR open - waiting for merge";
    case "pr_merged":
      return "PR merged - completed";
    case "pr_closed":
      return "PR closed without merge";
    case "changes_requested":
      return "Changes requested - Codex continuing";
    case "not_reviewable":
      return "Not reviewable";
  }
}

export function reviewGateTone(state: ReviewGateState): "neutral" | "ready" | "warning" {
  switch (state) {
    case "approved_ready_for_pr":
    case "pr_merged":
      return "ready";
    case "pr_closed":
      return "warning";
    default:
      return "neutral";
  }
}

export function reviewPrimaryAction(
  task: ServiceTask,
): "approve" | "request_changes" | "open_pr" | "refresh_pr" | "view_pr" | null {
  switch (reviewGateState(task)) {
    case "needs_review":
      return "approve";
    case "approved_ready_for_pr":
      return "open_pr";
    case "pr_open":
      return "refresh_pr";
    case "pr_merged":
      return task.githubPr ? "view_pr" : null;
    case "pr_closed":
      return canRequestChanges(task) ? "request_changes" : task.githubPr ? "view_pr" : null;
    case "changes_requested":
    case "not_reviewable":
      return null;
  }
}

export function canOpenPullRequest(task: ServiceTask): boolean {
  return reviewGateState(task) === "approved_ready_for_pr";
}

export function canRequestChanges(task: ServiceTask): boolean {
  return (
    task.status === "in_review" &&
    Boolean(task.handoff) &&
    task.githubPrState !== "open" &&
    task.githubPrState !== "merged"
  );
}

export function prStateLabel(task: ServiceTask): string | undefined {
  switch (task.githubPrState) {
    case "open":
      return "Open";
    case "merged":
      return "Merged";
    case "closed":
      return "Closed without merge";
    case undefined:
      return undefined;
    default:
      return "Unknown";
  }
}

export function harnessStatusForTask(
  task: ServiceTask,
  eligibility?: TaskEligibilityExplanation,
): HarnessStatusBadge | null {
  if (task.run?.state === "queued") {
    return { label: "Queued", reason: displayProgressStep(task.run), tone: "neutral" };
  }

  if (task.run?.state === "running") {
    return { label: "Running", reason: displayProgressStep(task.run), tone: "neutral" };
  }

  if (task.status === "in_review") {
    return {
      label: "In review",
      reason: safeReviewBranch(task.handoff?.headBranch ?? task.run?.reviewBranch),
      tone: "ready",
    };
  }

  if (task.status === "paused") {
    const blocked =
      task.pausedReason === "run_failed" || task.pausedReason === "blocked_by_setup";

    return {
      label: blocked ? "Blocked" : "Paused",
      reason: task.pausedExplanation,
      tone: "warning",
    };
  }

  if (task.status === "todo" && eligibility) {
    return eligibility.eligible
      ? { label: "Eligible", reason: eligibility.reason, tone: "ready" }
      : { label: "Not eligible", reason: eligibility.reason, tone: "warning" };
  }

  return null;
}

export function runTimelineForTask(
  task: Pick<ServiceTask, "run">,
  runEvents: CodingAssistantRunEvent[],
): CodingAssistantRunEvent[] {
  const events = runEvents.length > 0 ? runEvents : (task.run?.timeline ?? []);

  return events.map((event) => ({
    ...(event.id ? { id: event.id } : {}),
    ...(event.at || event.updatedAt ? { at: event.at ?? event.updatedAt } : {}),
    ...(event.label || event.displayStep ? { label: event.label ?? event.displayStep } : {}),
  }));
}

export function reviewHandoffForTask(task: ServiceTask): ReviewHandoffView {
  const summary = redactUnsafeText(task.handoff?.summary ?? task.reviewSummary);
  const files =
    task.handoff && task.handoff.filesChanged.length > 0
      ? task.handoff.filesChanged
      : task.filesChanged;
  const nextReviewAction = redactUnsafeText(
    task.handoff?.nextReviewAction ?? task.nextReviewAction,
  );
  const headBranch = safeReviewBranch(task.handoff?.headBranch);
  const baseBranch = safeReviewBranch(task.handoff?.baseBranch) ?? "main";
  const branch = headBranch
    ? `${headBranch} -> ${baseBranch}`
    : undefined;

  return {
    summary,
    files: files.filter(isReviewSafePath),
    nextReviewAction,
    branch,
    curatedSummaryPath: safeSummaryPath(task.handoff?.curatedSummaryPath),
    validationEvidence: (task.handoff?.validationEvidence ?? []).map((item) => ({
      ...item,
      label: redactUnsafeText(item.label) ?? "",
      detail: redactUnsafeText(item.detail) ?? "",
    })),
    proofNeeded: (task.reviewExpectations ?? []).map((item) => redactUnsafeText(item) ?? ""),
  };
}

export function runDisplayForTask(task: Pick<ServiceTask, "run">): {
  step?: string;
  message?: string;
} {
  return {
    step: task.run ? displayProgressStep(task.run) : undefined,
    message: redactUnsafeText(task.run?.displayMessage ?? task.run?.message),
  };
}

function displayProgressStep(run: CodingAssistantRun): string | undefined {
  if (run.displayStep) return run.displayStep;

  switch (run.currentStep) {
    case "Preparing repository":
      return "Preparing workspace";
    case "Preparing Codex App Server thread":
    case "Running Coding Assistant":
      return "Starting Codex";
    case "Detecting changed files":
    case "Creating branch":
    case "Creating review branch":
      return "Checking changes";
    default:
      return run.currentStep;
  }
}

export function safeReviewBranch(branch?: string): string | undefined {
  if (!branch || !isReviewSafePath(branch)) return undefined;
  return branch;
}

export function safeSummaryPath(path?: string): string | undefined {
  return path && isReviewSafePath(path) ? path : undefined;
}

function isReviewSafePath(path: string): boolean {
  return !path.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(path);
}

function redactUnsafeText(value?: string): string | undefined {
  return value
    ?.replace(/(^|[\s(])\/(?:Users|private|tmp|var|Volumes|home|opt|usr)\/[^\s)]+/g, "$1[local path hidden]")
    .replace(/\b[A-Z][A-Z0-9_]*(TOKEN|SECRET|KEY|PASSWORD)=\S+/g, "[environment value hidden]");
}
