export type LandingFeature = {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  image: string;
  imageAlt: string;
  imageWidth: number;
  imageHeight: number;
  reverse?: boolean;
};

export type MoreFeature = {
  title: string;
  body: string;
  label?: string;
};

export const navItems = [
  { label: "Features", href: "#features" },
  { label: "Workflow", href: "#workflow" },
  { label: "Pricing", href: "#pricing" },
  { label: "Community", href: "#community" },
];

export const platformPills = ["GitHub", "Workspaces", "Reviews"];

export const proofItems = ["Human review gate", "Branch-safe runs", "Replayable evidence"];

export const features: LandingFeature[] = [
  {
    eyebrow: "Interactive Dashboard Surfaces",
    title: "See every task, workspace, run, and review trail in one calm place.",
    body:
      "Symphonia turns scattered agent work into a visible operating surface, so teams can compare status, evidence, and next decisions without spelunking through tools.",
    bullets: [
      "Task boards stay connected to the repository.",
      "Run state and review state sit beside the work.",
      "Dashboards stay quiet enough for daily use.",
    ],
    image: "/images/device-stack.png",
    imageAlt: "Minimal line illustration of synced dashboard surfaces.",
    imageWidth: 1376,
    imageHeight: 768,
  },
  {
    eyebrow: "Plain-Text Specifications to Code",
    title: "Start with a spec and carry it all the way to reviewed code.",
    body:
      "Clarise shapes milestones from natural language, then Codex executes tasks with repository context, proof expectations, and the right handoff path.",
    bullets: [
      "Milestones become implementation-ready task briefs.",
      "Every run keeps the source request attached.",
      "Evidence follows the work into review.",
    ],
    image: "/images/code-editor.png",
    imageAlt: "Minimal line illustration of a code editor.",
    imageWidth: 1024,
    imageHeight: 1024,
    reverse: true,
  },
  {
    eyebrow: "Milestones & Branches",
    title: "Let the work stay grouped by the branch and milestone that created it.",
    body:
      "Plans do not flatten into a generic queue. Symphonia keeps each task tied to the project shape, branch policy, and review path the team already understands.",
    bullets: [
      "Milestones create natural bundles of work.",
      "Branches stay visible before pull requests exist.",
      "Review handoffs keep their original context.",
    ],
    image: "/images/git-branch.png",
    imageAlt: "Minimal line illustration of a branching Git history.",
    imageWidth: 1408,
    imageHeight: 768,
  },
  {
    eyebrow: "The Human Review Gate",
    title: "Inspect the diff, logs, and proof before anything ships.",
    body:
      "Symphonia makes agent output reviewable instead of magical. People can approve, request changes, or open a pull request when the evidence is ready.",
    bullets: [
      "Review state is separate from execution state.",
      "Open questions stay visible beside the diff.",
      "Pull request creation remains an intentional step.",
    ],
    image: "/images/terminal.png",
    imageAlt: "Minimal line illustration of an automation terminal.",
    imageWidth: 1376,
    imageHeight: 768,
    reverse: true,
  },
];

export const moreFeatures: MoreFeature[] = [
  {
    title: "Continuous Agent Execution",
    body:
      "Background runs stream progress in real time, while the public surface stays curated and readable.",
    label: "SYNC",
  },
  {
    title: "Repository-Aware Context",
    body:
      "Each task can carry relevant files, prior decisions, validation commands, and review expectations.",
  },
  {
    title: "Private by Default",
    body:
      "Raw runner output stays out of the landing surface; teams see the state they need to act.",
  },
  {
    title: "Review-Ready Handoffs",
    body:
      "Diffs, evidence, and remaining questions arrive together, so reviewers can make real decisions.",
  },
];

export const footerGroups = [
  { title: "Symphonia", links: ["Features", "Workflow", "Pricing"] },
  { title: "Support", links: ["Docs", "Status", "Contact"] },
  { title: "Community", links: ["Blog", "Examples", "Updates"] },
];
