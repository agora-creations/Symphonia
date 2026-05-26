"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Onborda, OnbordaProvider as OnbordaRootProvider, useOnborda } from "onborda";
import type { CardComponentProps, Step } from "onborda";
import { ArrowLeft, ArrowRight, Check, GitBranch, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "symphonia.onboarding.v1";

type TourName = "first-repository-setup" | "first-task" | "first-codex-review";

interface RepoOnboardingState {
  hasSeenRepositorySetupTour: boolean;
  hasCreatedFirstTask: boolean;
  hasStartedFirstCodexRun: boolean;
  hasReviewedFirstHandoff: boolean;
  dismissedTours?: Partial<Record<TourName, boolean>>;
}

interface OnboardingState {
  global: {
    hasSeenIntroTour: boolean;
  };
  repos: Record<string, RepoOnboardingState>;
}

type SymphoniaStep = Step & {
  blockNextUntilSelector?: string;
  blockNextReason?: string;
};

type OnbordaTour = {
  tour: TourName;
  steps: SymphoniaStep[];
};

const emptyRepoState: RepoOnboardingState = {
  hasSeenRepositorySetupTour: false,
  hasCreatedFirstTask: false,
  hasStartedFirstCodexRun: false,
  hasReviewedFirstHandoff: false,
  dismissedTours: {},
};

const defaultState: OnboardingState = {
  global: {
    hasSeenIntroTour: false,
  },
  repos: {},
};

const tours: OnbordaTour[] = [
  {
    tour: "first-repository-setup",
    steps: [
      {
        icon: <GitBranch className="h-3.5 w-3.5" />,
        title: "Choose a repository",
        content:
          "Pick the repository where Symphonia should keep tasks, reviews, decisions, and run summaries.",
        selector: "#repository-picker",
        side: "bottom",
        pointerPadding: 12,
        pointerRadius: 12,
        blockNextUntilSelector: "#repository-setup-status",
        blockNextReason: "Open a repository to continue setup.",
      } satisfies SymphoniaStep,
      {
        icon: <Check className="h-3.5 w-3.5" />,
        title: "Repository setup",
        content:
          "This single checklist covers Symphonia files, repository rules, GitHub, and Codex readiness.",
        selector: "#repository-setup-status",
        side: "bottom-left",
        pointerPadding: 10,
        pointerRadius: 10,
      },
      {
        icon: <Check className="h-3.5 w-3.5" />,
        title: "Repository rules",
        content:
          "Rules tell Codex when to ask for review, when to retry, and when a pull request may be opened.",
        selector: "#repository-rules-card",
        side: "bottom",
        pointerPadding: 10,
        pointerRadius: 10,
      },
      {
        icon: <Check className="h-3.5 w-3.5" />,
        title: "GitHub connection",
        content:
          "GitHub lets Symphonia create review branches and open pull requests only after your approval.",
        selector: "#github-connect-card",
        side: "bottom",
        pointerPadding: 10,
        pointerRadius: 10,
      },
      {
        icon: <Check className="h-3.5 w-3.5" />,
        title: "Codex readiness",
        content:
          "Codex can be enabled after repository setup. If it is unavailable, finish setup now and enable Codex later.",
        selector: "#codex-enable-card",
        side: "bottom-right",
        pointerPadding: 10,
        pointerRadius: 10,
      },
    ],
  },
  {
    tour: "first-task",
    steps: [
      {
        icon: <Check className="h-3.5 w-3.5" />,
        title: "Create the first task",
        content:
          "A task is the durable brief for Codex: goal, context, and the proof needed for review.",
        selector: "#create-first-task-button",
        side: "left",
        pointerPadding: 10,
        pointerRadius: 8,
      },
    ],
  },
  {
    tour: "first-codex-review",
    steps: [
      {
        icon: <Check className="h-3.5 w-3.5" />,
        title: "Ask Codex to work",
        content:
          "Codex works from the task brief and returns changed files, summary, and validation evidence.",
        selector: "#ask-codex-button",
        side: "bottom",
        pointerPadding: 10,
        pointerRadius: 8,
        blockNextUntilSelector: "#review-handoff-panel",
        blockNextReason: "Codex needs to finish before the handoff can be reviewed.",
      } satisfies SymphoniaStep,
      {
        icon: <Check className="h-3.5 w-3.5" />,
        title: "Review the handoff",
        content:
          "Use the handoff to inspect the summary, changed files, validation evidence, and next review action.",
        selector: "#review-handoff-panel",
        side: "left",
        pointerPadding: 10,
        pointerRadius: 8,
      },
    ],
  },
];

function repoState(state: OnboardingState, repoKey: string): RepoOnboardingState {
  return { ...emptyRepoState, ...(state.repos[repoKey] ?? {}) };
}

function readState(): OnboardingState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    return {
      global: {
        hasSeenIntroTour: Boolean(parsed.global?.hasSeenIntroTour),
      },
      repos: Object.fromEntries(
        Object.entries(parsed.repos ?? {}).map(([key, value]) => [
          key.toUpperCase(),
          { ...emptyRepoState, ...value },
        ]),
      ),
    };
  } catch {
    return defaultState;
  }
}

function writeState(state: OnboardingState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function repoKeyFromPath(pathname: string | null): string | null {
  const match = pathname?.match(/^\/r\/([^/]+)/);
  return match ? decodeURIComponent(match[1]).toUpperCase() : null;
}

function queryStep(tourName: string | null, stepIndex: number): Step | null {
  const tour = tours.find((item) => item.tour === tourName);
  return tour?.steps[stepIndex] ?? null;
}

function selectorExists(selector: string): boolean {
  return typeof document !== "undefined" && document.querySelector(selector) != null;
}

function waitForSelector(selector: string, callback: () => void): () => void {
  if (selectorExists(selector)) {
    callback();
    return () => {};
  }

  const observer = new MutationObserver(() => {
    if (!selectorExists(selector)) return;
    observer.disconnect();
    window.clearTimeout(timeout);
    callback();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  const timeout = window.setTimeout(() => observer.disconnect(), 5000);

  return () => {
    observer.disconnect();
    window.clearTimeout(timeout);
  };
}

function isRepoReadyForFirstTask(): boolean {
  const setup = document.querySelector("#repository-setup-status");
  return setup?.getAttribute("data-repository-ready") === "true";
}

export function SymphoniaOnboardingProvider({ children }: { children: ReactNode }) {
  return (
    <OnbordaRootProvider>
      <OnboardingSurface>{children}</OnboardingSurface>
    </OnbordaRootProvider>
  );
}

function OnboardingSurface({ children }: { children: ReactNode }) {
  return (
    <Onborda
      steps={tours}
      cardComponent={SymphoniaOnboardingCard}
      shadowRgb="17, 24, 39"
      shadowOpacity="0.34"
      cardTransition={{ duration: 0.22, type: "tween" }}
    >
      <OnboardingController>{children}</OnboardingController>
    </Onborda>
  );
}

function OnboardingController({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentStep, currentTour, isOnbordaVisible, startOnborda, setCurrentStep, closeOnborda } =
    useOnborda();
  const [state, setState] = useState<OnboardingState>(defaultState);
  const [loaded, setLoaded] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const startLock = useRef(false);

  useEffect(() => {
    setState(readState());
    setLoaded(true);
  }, []);

  const persist = useCallback((updater: (current: OnboardingState) => OnboardingState) => {
    setState((current) => {
      const next = updater(current);
      writeState(next);
      return next;
    });
  }, []);

  const updateRepo = useCallback(
    (repoKey: string, updater: (current: RepoOnboardingState) => RepoOnboardingState) => {
      persist((current) => ({
        ...current,
        repos: {
          ...current.repos,
          [repoKey]: updater(repoState(current, repoKey)),
        },
      }));
    },
    [persist],
  );

  const startTourAt = useCallback(
    (tourName: TourName, stepIndex = 0) => {
      if (startLock.current || isOnbordaVisible) return;
      const step = queryStep(tourName, stepIndex);
      if (!step) return;

      startLock.current = true;
      waitForSelector(step.selector, () => {
        startOnborda(tourName);
        if (stepIndex > 0) setCurrentStep(stepIndex);
        window.setTimeout(() => {
          startLock.current = false;
          setRetryTick((tick) => tick + 1);
        }, 250);
      });
      window.setTimeout(() => {
        startLock.current = false;
        setRetryTick((tick) => tick + 1);
      }, 5500);
    },
    [isOnbordaVisible, setCurrentStep, startOnborda],
  );

  useEffect(() => {
    if (!loaded || isOnbordaVisible || startLock.current) return;

    const repoKey = repoKeyFromPath(pathname);
    if (!repoKey) {
      if (!state.global.hasSeenIntroTour && selectorExists("#repository-picker")) {
        startTourAt("first-repository-setup", 0);
      }
      return;
    }

    const repo = repoState(state, repoKey);
    const dismissed = repo.dismissedTours ?? {};

    if (
      !repo.hasSeenRepositorySetupTour &&
      !dismissed["first-repository-setup"] &&
      selectorExists("#repository-setup-status")
    ) {
      startTourAt("first-repository-setup", 1);
      return;
    }

    if (
      !repo.hasCreatedFirstTask &&
      !dismissed["first-task"] &&
      selectorExists("#create-first-task-button") &&
      isRepoReadyForFirstTask()
    ) {
      startTourAt("first-task", 0);
      return;
    }

    if (
      repo.hasCreatedFirstTask &&
      !repo.hasStartedFirstCodexRun &&
      !dismissed["first-codex-review"] &&
      selectorExists("#ask-codex-button")
    ) {
      startTourAt("first-codex-review", 0);
      return;
    }

    if (
      repo.hasStartedFirstCodexRun &&
      !repo.hasReviewedFirstHandoff &&
      !dismissed["first-codex-review"] &&
      selectorExists("#review-handoff-panel")
    ) {
      startTourAt("first-codex-review", 1);
    }
  }, [isOnbordaVisible, loaded, pathname, retryTick, startTourAt, state]);

  useEffect(() => {
    if (!isOnbordaVisible || !currentTour) return;
    const step = queryStep(currentTour, currentStep);
    if (!step || selectorExists(step.selector)) return;

    const tourName = currentTour as TourName;
    const stepIndex = currentStep;
    closeOnborda();
    return waitForSelector(step.selector, () => startTourAt(tourName, stepIndex));
  }, [closeOnborda, currentStep, currentTour, isOnbordaVisible, pathname, startTourAt]);

  useEffect(() => {
    if (!loaded) return;

    const markTaskCreated = (event: Event) => {
      const detail = (event as CustomEvent<{ repoKey?: string }>).detail;
      const repoKey = detail?.repoKey?.toUpperCase() ?? repoKeyFromPath(pathname);
      if (!repoKey) return;
      updateRepo(repoKey, (repo) => ({ ...repo, hasCreatedFirstTask: true }));
    };

    const markCodexStarted = (event: Event) => {
      const detail = (event as CustomEvent<{ repoKey?: string }>).detail;
      const repoKey = detail?.repoKey?.toUpperCase() ?? repoKeyFromPath(pathname);
      if (!repoKey) return;
      updateRepo(repoKey, (repo) => ({ ...repo, hasStartedFirstCodexRun: true }));
    };

    const markHandoffViewed = (event: Event) => {
      const detail = (event as CustomEvent<{ repoKey?: string }>).detail;
      const repoKey = detail?.repoKey?.toUpperCase() ?? repoKeyFromPath(pathname);
      if (!repoKey) return;
      updateRepo(repoKey, (repo) => ({ ...repo, hasReviewedFirstHandoff: true }));
    };

    const dismissTour = (event: Event) => {
      const detail = (event as CustomEvent<{ tour?: TourName; complete?: boolean }>).detail;
      const tour = detail?.tour;
      if (!tour) return;

      const repoKey = repoKeyFromPath(pathname);
      persist((current) => {
        if (!repoKey) {
          return {
            ...current,
            global: {
              ...current.global,
              hasSeenIntroTour: true,
            },
          };
        }

        const repo = repoState(current, repoKey);
        return {
          ...current,
          global: {
            ...current.global,
            hasSeenIntroTour: current.global.hasSeenIntroTour || tour === "first-repository-setup",
          },
          repos: {
            ...current.repos,
            [repoKey]: {
              ...repo,
              hasSeenRepositorySetupTour:
                repo.hasSeenRepositorySetupTour || tour === "first-repository-setup",
              dismissedTours: {
                ...(repo.dismissedTours ?? {}),
                [tour]: true,
              },
            },
          },
        };
      });
      closeOnborda();
    };

    const restartTour = (_event: Event) => {
      const repoKey = repoKeyFromPath(pathname);
      if (!repoKey) {
        persist((current) => ({
          ...current,
          global: { hasSeenIntroTour: false },
        }));
        startTourAt("first-repository-setup", 0);
        return;
      }

      updateRepo(repoKey, (repo) => ({
        ...repo,
        hasSeenRepositorySetupTour: false,
        dismissedTours: {
          ...(repo.dismissedTours ?? {}),
          "first-repository-setup": false,
        },
      }));
      void router.push(`/r/${repoKey.toLowerCase()}/tasks`);
      window.setTimeout(() => startTourAt("first-repository-setup", 1), 250);
    };

    window.addEventListener("symphonia:taskCreated", markTaskCreated as EventListener);
    window.addEventListener("symphonia:codexRunStarted", markCodexStarted as EventListener);
    window.addEventListener("symphonia:taskHandoffViewed", markHandoffViewed as EventListener);
    window.addEventListener("symphonia:onboarding:dismiss", dismissTour as EventListener);
    window.addEventListener("symphonia:onboarding:restart", restartTour);

    return () => {
      window.removeEventListener("symphonia:taskCreated", markTaskCreated as EventListener);
      window.removeEventListener("symphonia:codexRunStarted", markCodexStarted as EventListener);
      window.removeEventListener("symphonia:taskHandoffViewed", markHandoffViewed as EventListener);
      window.removeEventListener("symphonia:onboarding:dismiss", dismissTour as EventListener);
      window.removeEventListener("symphonia:onboarding:restart", restartTour);
    };
  }, [closeOnborda, loaded, pathname, persist, router, startTourAt, updateRepo]);

  return <>{children}</>;
}

function SymphoniaOnboardingCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  arrow,
}: CardComponentProps) {
  const { closeOnborda, currentTour } = useOnborda();
  const symphoniaStep = step as SymphoniaStep;
  const isLast = currentStep >= totalSteps - 1;
  const blocked =
    symphoniaStep.blockNextUntilSelector != null &&
    !selectorExists(symphoniaStep.blockNextUntilSelector);

  const dismiss = (complete: boolean) => {
    window.dispatchEvent(
      new CustomEvent("symphonia:onboarding:dismiss", {
        detail: { tour: currentTour, complete },
      }),
    );
    closeOnborda();
  };

  return (
    <div className="relative w-[min(22rem,calc(100vw-2rem))] rounded-lg border bg-background text-foreground shadow-2xl">
      <div className="flex items-start gap-3 border-b px-3 py-3">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-foreground text-background">
          {typeof step.icon === "string" ? <span className="text-xs">{step.icon}</span> : step.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{step.title}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Step {currentStep + 1} of {totalSteps}
          </div>
        </div>
        <button
          type="button"
          onClick={() => dismiss(false)}
          aria-label="Skip tour"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="px-3 py-3 text-sm leading-5 text-muted-foreground">{step.content}</div>
      {blocked && (
        <div className="mx-3 mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300">
          {symphoniaStep.blockNextReason ?? "Complete the current action to continue."}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
        <button
          type="button"
          onClick={currentStep === 0 ? () => dismiss(false) : prevStep}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {currentStep === 0 ? (
            "Skip"
          ) : (
            <>
              <ArrowLeft className="h-3 w-3" />
              Back
            </>
          )}
        </button>
        <button
          type="button"
          onClick={isLast ? () => dismiss(true) : nextStep}
          disabled={blocked}
          className={cn(
            "inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {isLast ? "Finish" : "Next"}
          {!isLast && <ArrowRight className="h-3 w-3" />}
        </button>
      </div>
      <div className="text-background">{arrow}</div>
    </div>
  );
}
