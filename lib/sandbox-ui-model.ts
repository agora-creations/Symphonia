export interface OpenSandboxOperationsLike {
  lastSmokeStatus?: "passed" | "failed" | "never_run" | "running" | string;
  cleanupWarning?: boolean;
}

export type SandboxTone = "ready" | "warning" | "blocked" | "neutral";

export function sandboxSmokeLabel(operations?: OpenSandboxOperationsLike | null): string {
  switch (operations?.lastSmokeStatus) {
    case "passed":
      return "Smoke passed";
    case "failed":
      return "Smoke failed";
    case "running":
      return "Smoke running";
    default:
      return "Smoke never run";
  }
}

export function sandboxSmokeTone(
  operations?: OpenSandboxOperationsLike | null,
): SandboxTone {
  switch (operations?.lastSmokeStatus) {
    case "passed":
      return "ready";
    case "failed":
      return "warning";
    default:
      return "neutral";
  }
}

export function sandboxCleanupLabel(operations?: OpenSandboxOperationsLike | null): string {
  return operations?.cleanupWarning ? "Cleanup warning" : "Cleanup clear";
}
