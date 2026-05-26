import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Check,
  Code2,
  FileText,
  GitBranch,
  Github,
  GitPullRequestArrow,
  Layers3,
  LockKeyhole,
  MessageSquareText,
  MonitorCog,
  Play,
  Sparkles,
  WandSparkles,
  Workflow,
  Zap,
} from "lucide-react";

const videos = {
  connect: "/videos/connect-repository.mp4",
  connectPoster: "/videos/connect-repository-frame.png",
  clarise: "/videos/clarise-milestone.mp4",
  clarisePoster: "/videos/clarise-milestone-frame.png",
  review: "/videos/task-to-review.mp4",
  reviewPoster: "/videos/task-to-review-frame.png",
  automation: "/videos/automation-controlled.mp4",
  automationPoster: "/videos/automation-controlled-frame.png",
};

const builderCards = [
  {
    title: "Unlimited tasks, reviews, and evidence",
    description:
      "No brittle handoff chain. Symphonia keeps every task, workspace, run, and review trail in one place so teams can keep shipping.",
    icon: Sparkles,
    highlight: true,
    video: videos.automation,
    poster: videos.automationPoster,
  },
  {
    title: "Just connect a repository",
    description:
      "Start with the codebase you already have. Symphonia reads the project shape and gives every plan a real workspace.",
    icon: Github,
    video: videos.connect,
    poster: videos.connectPoster,
  },
  {
    title: "Private by default",
    description:
      "Run logs, artifacts, and local proof stay attached to the work instead of spilling into a scattered tool trail.",
    icon: LockKeyhole,
  },
];

const workLoop = [
  {
    title: "Connect",
    body: "Bring in a repository and let Symphonia map the workspace, files, tasks, and docs around it.",
    icon: Github,
  },
  {
    title: "Plan",
    body: "Clarise turns fuzzy goals into milestones, decisions, and reviewable implementation steps.",
    icon: WandSparkles,
  },
  {
    title: "Run",
    body: "Hand a task to Codex with the right files, constraints, and context already in place.",
    icon: Workflow,
  },
  {
    title: "Review",
    body: "Inspect the diff, evidence, and open questions before anything becomes a pull request.",
    icon: GitPullRequestArrow,
  },
];

const intelligentCards = [
  {
    title: "Milestone loops",
    body: "Keep a long build moving one validated checkpoint at a time.",
    icon: Layers3,
  },
  {
    title: "Task context",
    body: "Pair every task with files, docs, decisions, and expected proof.",
    icon: FileText,
  },
  {
    title: "Automation control",
    body: "Watch background runs without losing the human review gate.",
    icon: MonitorCog,
  },
];

const audienceCards = [
  "Founders",
  "Product",
  "Engineering",
  "AI agents",
  "Docs",
  "Operations",
];

const faqs = [
  {
    question: "Is Symphonia another task tracker?",
    answer:
      "No. It treats tasks as launch points for real implementation work, then keeps the plan, workspace, run evidence, and review state together.",
  },
  {
    question: "Can it work with an existing repository?",
    answer:
      "Yes. The core workflow starts by connecting a repository, then builds planning and execution surfaces around the code that already exists.",
  },
  {
    question: "Where does the human stay in the loop?",
    answer:
      "At the review gate. Symphonia can prepare and run the work, but diffs, evidence, and pull request decisions stay visible before shipping.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f5ef] font-sans text-[#27251f]">
      <SiteHeader />
      <HeroSection />
      <LogoStrip />
      <BuilderSection />
      <WorkflowSection />
      <IntelligenceSection />
      <ReviewSection />
      <IntegrationsSection />
      <AudienceSection />
      <FinalCta />
      <FaqSection />
      <SiteFooter />
    </main>
  );
}

function SiteHeader() {
  return (
    <header className="flex h-[60px] items-center justify-between bg-white px-5 text-[15px] text-[#37352f]">
      <Link href="/" className="font-serif text-[28px] font-black tracking-[-0.06em] text-black">
        symphonia*
      </Link>
      <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
        <a className="transition-colors hover:text-black" href="#product">
          Product
        </a>
        <a className="transition-colors hover:text-black" href="#workflow">
          Workflow
        </a>
        <a className="transition-colors hover:text-black" href="#review">
          Review
        </a>
        <a className="transition-colors hover:text-black" href="#faq">
          Questions
        </a>
      </nav>
      <div className="flex items-center gap-4">
        <Link className="hidden transition-colors hover:text-black sm:inline" href="/dashboard">
          Log in
        </Link>
        <Link className="hidden transition-colors hover:text-black sm:inline" href="/dashboard">
          Sign up
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0070d7] px-4 text-[15px] font-medium text-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] transition hover:bg-[#005fbb]"
        >
          Connect repo
        </Link>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden bg-black px-5 pb-20 pt-28 text-white md:pb-28">
      <Doodle className="left-[3%] top-[38%] rotate-[-8deg]" text="Ship!" />
      <Doodle className="right-[8%] top-[28%] rotate-[10deg]" text="yes!" />
      <Doodle className="right-[3%] top-[48%] rotate-[21deg]" text="merge" />
      <div className="absolute left-[24%] top-[23%] h-2 w-36 rotate-[-3deg] rounded-full bg-[#f81ce5] shadow-[0_0_18px_rgba(248,28,229,0.8)]" />
      <div className="absolute left-[2%] top-[61%] h-1.5 w-12 rotate-45 rounded-full bg-[#f81ce5]" />
      <div className="absolute right-[24%] top-[36%] h-1.5 w-12 -rotate-[54deg] rounded-full bg-white" />
      <div className="absolute right-[3%] top-[60%] h-1.5 w-14 -rotate-45 rounded-full bg-white" />

      <div className="mx-auto flex max-w-[1120px] flex-col items-center text-center">
        <p className="mb-6 max-w-[560px] text-[22px] font-semibold leading-[1.18] tracking-[-0.03em] text-[#36342f] md:text-[26px]">
          Say goodbye to scattered AI work. Meet Symphonia - the workspace where
          specs become reviewed code.
        </p>
        <h1 className="max-w-[1020px] text-balance text-[46px] font-bold leading-[0.96] tracking-[-0.045em] text-white md:text-[72px]">
          The simplest way to turn specs into shipped work
        </h1>
        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0070d7] px-4 text-[15px] font-semibold text-white transition hover:bg-[#005fbb]"
          >
            Connect a repository
            <ArrowRight className="h-4 w-4" />
          </Link>
          <span className="text-[13px] text-[#6a6861]">No workflow rebuild required</span>
        </div>

        <div className="mt-16 w-full max-w-[976px]">
          <VideoWindow
            title="Connect repository"
            src={videos.connect}
            poster={videos.connectPoster}
            caption="Repository setup becomes the first real step of the work, not a separate admin errand."
            priority
          />
        </div>
      </div>
    </section>
  );
}

function LogoStrip() {
  return (
    <section className="border-b border-[#e6e0d7] bg-[#f7f5ef] px-5 py-14">
      <div className="mx-auto flex max-w-[976px] flex-col items-center gap-7 text-center">
        <p className="max-w-2xl text-[18px] leading-7 text-[#5f5c55]">
          Built for teams who want AI coding work to stay connected to the
          repository, the plan, and the review that actually matters.
        </p>
        <div className="grid w-full grid-cols-2 gap-3 text-left sm:grid-cols-4">
          {["Brief", "Workspace", "Run", "Review"].map((label) => (
            <div
              key={label}
              className="rounded-[10px] border border-[#ded8cf] bg-white px-4 py-3 text-center text-[15px] font-semibold text-[#37352f] shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BuilderSection() {
  return (
    <section id="product" className="px-5 py-20 md:py-28">
      <SectionTitle eyebrow="A workspace like no other" title="Plan, run, and review in one place" />
      <div className="mx-auto mt-12 grid max-w-[976px] gap-8 md:grid-cols-[1.15fr_0.85fr]">
        <FeatureCard {...builderCards[0]} />
        <div className="grid gap-8">
          {builderCards.slice(1).map((card) => (
            <FeatureCard key={card.title} {...card} />
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowSection() {
  return (
    <section id="workflow" className="px-5 pb-20 md:pb-28">
      <SectionTitle eyebrow="Simple but powerful" title="A build loop that follows the work" />
      <div className="mx-auto mt-12 max-w-[976px] rounded-[10px] bg-[#fefefe] shadow-[0_1px_1px_rgba(0,0,0,0.12),0_0_0_1px_rgba(61,59,53,0.16),0_3px_9px_rgba(61,59,53,0.08)]">
        <div className="grid gap-0 overflow-hidden rounded-[10px] lg:grid-cols-[0.9fr_1.1fr]">
          <div className="p-6 md:p-8">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#f81ce5]/10 px-3 py-1 text-[13px] font-semibold text-[#9f118f]">
              <Workflow className="h-4 w-4" />
              Issue to pull request
            </div>
            <h3 className="text-[34px] font-bold leading-[1.02] tracking-[-0.04em] md:text-[46px]">
              Build from the task, not from a blank chat.
            </h3>
            <p className="mt-4 text-[17px] leading-7 text-[#5f5c55]">
              Symphonia keeps the brief, repository state, implementation run,
              evidence, and review handoff moving through the same surface.
            </p>
            <div className="mt-8 grid gap-4">
              {workLoop.map((item) => (
                <IconRow key={item.title} {...item} />
              ))}
            </div>
          </div>
          <div className="border-t border-[#ebe6de] bg-[#fbfaf7] p-5 lg:border-l lg:border-t-0">
            <VideoWindow
              title="Clarise milestone loop"
              src={videos.clarise}
              poster={videos.clarisePoster}
              compact
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function IntelligenceSection() {
  return (
    <section className="px-5 pb-20 md:pb-28">
      <SectionTitle eyebrow="Craft intelligent work loops" title="Give every agent run a real job" />
      <div className="mx-auto mt-12 grid max-w-[976px] gap-8 lg:grid-cols-3">
        {intelligentCards.map((card) => (
          <div
            key={card.title}
            className="rounded-[10px] bg-[#fefefe] p-6 shadow-[0_1px_1px_rgba(0,0,0,0.12),0_0_0_1px_rgba(61,59,53,0.16),0_3px_9px_rgba(61,59,53,0.08)]"
          >
            <span className="mb-5 grid h-11 w-11 place-items-center rounded-[9px] bg-[#f7f5ef] text-[#0070d7]">
              <card.icon className="h-5 w-5" />
            </span>
            <h3 className="text-[24px] font-bold tracking-[-0.035em]">{card.title}</h3>
            <p className="mt-3 text-[15px] leading-6 text-[#6a6861]">{card.body}</p>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-8 max-w-[976px]">
        <VideoWindow
          title="Automation controlled"
          src={videos.automation}
          poster={videos.automationPoster}
          caption="Background runs stay readable: status, progress, and evidence sit beside the task."
        />
      </div>
    </section>
  );
}

function ReviewSection() {
  return (
    <section id="review" className="px-5 pb-20 md:pb-28">
      <SectionTitle eyebrow="Make review feel inevitable" title="Turn AI output into a decision" />
      <div className="mx-auto mt-12 grid max-w-[976px] gap-8 lg:grid-cols-[1fr_0.92fr]">
        <VideoWindow
          title="Task to review"
          src={videos.review}
          poster={videos.reviewPoster}
          caption="A task becomes a review-ready package: diff, state, and proof in one place."
        />
        <div className="rounded-[10px] bg-[#fefefe] p-7 shadow-[0_1px_1px_rgba(0,0,0,0.12),0_0_0_1px_rgba(61,59,53,0.16),0_3px_9px_rgba(61,59,53,0.08)]">
          <h3 className="text-[32px] font-bold leading-tight tracking-[-0.04em]">
            Review before the pull request exists.
          </h3>
          <p className="mt-4 text-[16px] leading-7 text-[#5f5c55]">
            Symphonia keeps the human review gate visible. You can compare what
            was requested, what changed, what passed, and what still needs a call.
          </p>
          <div className="mt-8 grid gap-3">
            {["Evidence attached", "Open questions surfaced", "Pull request handoff ready"].map(
              (item) => (
                <div key={item} className="flex items-center gap-3 text-[15px] font-medium">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[#e9f6ef] text-[#168b4a]">
                    <Check className="h-4 w-4" />
                  </span>
                  {item}
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function IntegrationsSection() {
  const integrations = [
    { name: "GitHub", icon: Github },
    { name: "Branches", icon: GitBranch },
    { name: "Codex", icon: Code2 },
    { name: "Docs", icon: FileText },
    { name: "Reviews", icon: MessageSquareText },
    { name: "Automation", icon: Zap },
  ];

  return (
    <section id="connect" className="border-y border-[#e6e0d7] bg-[#fffdf8] px-5 py-20 md:py-28">
      <SectionTitle eyebrow="Connect your favorite tools" title="Keep the work close to the code" />
      <div className="mx-auto mt-12 grid max-w-[976px] gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((item) => (
          <div
            key={item.name}
            className="flex items-center gap-4 rounded-[10px] border border-[#e0dbd2] bg-white p-4 shadow-[0_1px_1px_rgba(0,0,0,0.06)]"
          >
            <span className="grid h-12 w-12 place-items-center rounded-[9px] bg-[#f7f5ef] text-[#0070d7]">
              <item.icon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-[17px] font-bold tracking-[-0.02em]">{item.name}</h3>
              <p className="text-[13px] text-[#77746c]">Connected workflow surface</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AudienceSection() {
  return (
    <section className="px-5 py-20 md:py-28">
      <SectionTitle eyebrow="Designed for you" title="Useful wherever specs meet code" />
      <div className="mx-auto mt-12 grid max-w-[976px] gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {audienceCards.map((item) => (
          <div
            key={item}
            className="group rounded-[10px] bg-[#fefefe] p-6 shadow-[0_1px_1px_rgba(0,0,0,0.12),0_0_0_1px_rgba(61,59,53,0.16),0_3px_9px_rgba(61,59,53,0.08)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_1px_1px_rgba(0,0,0,0.12),0_0_0_1px_rgba(61,59,53,0.16),0_12px_28px_rgba(61,59,53,0.16)]"
          >
            <h3 className="text-[24px] font-bold tracking-[-0.035em]">{item}</h3>
            <p className="mt-3 text-[15px] leading-6 text-[#6a6861]">
              Move from intent to reviewed implementation without splitting the
              story across five separate tools.
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-black px-5 py-20 text-center text-white md:py-28">
      <div className="mx-auto max-w-[760px]">
        <p className="mb-5 text-[15px] font-semibold uppercase tracking-[0.18em] text-[#f81ce5]">
          Build stunning workflows
        </p>
        <h2 className="text-balance text-[42px] font-bold leading-[1] tracking-[-0.045em] md:text-[64px]">
          Give every spec a path to shipped code
        </h2>
        <p className="mx-auto mt-6 max-w-[580px] text-[18px] leading-7 text-[#aaa7a0]">
          Connect the repository, shape the plan, start the run, and review the
          result without losing the thread.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#0070d7] px-5 text-[15px] font-semibold text-white transition hover:bg-[#005fbb]"
          >
            Start with a repository
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section id="faq" className="px-5 py-20 md:py-28">
      <SectionTitle eyebrow="Questions & answers" title="A little less mystery" />
      <div className="mx-auto mt-10 max-w-[820px] divide-y divide-[#e1dbd2] rounded-[10px] bg-white shadow-[0_1px_1px_rgba(0,0,0,0.08),0_0_0_1px_rgba(61,59,53,0.12)]">
        {faqs.map((faq) => (
          <details key={faq.question} className="group p-6" open={faq === faqs[0]}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left text-[18px] font-bold tracking-[-0.025em]">
              {faq.question}
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f7f5ef] text-[#0070d7] transition group-open:rotate-45">
                <ArrowRight className="h-4 w-4" />
              </span>
            </summary>
            <p className="mt-4 max-w-[680px] text-[15px] leading-6 text-[#6a6861]">{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-[#e1dbd2] bg-white px-5 py-10">
      <div className="mx-auto flex max-w-[976px] flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="font-serif text-[28px] font-black tracking-[-0.06em] text-black">
            symphonia*
          </div>
          <p className="mt-2 max-w-sm text-[14px] leading-6 text-[#6a6861]">
            A spec-to-agent workspace for teams that want AI coding work to end
            in reviewable, evidence-backed code.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-10 text-[14px] sm:grid-cols-3">
          <FooterColumn title="Product" links={["Workflow", "Review", "Automation"]} />
          <FooterColumn title="Resources" links={["Docs", "Templates", "Examples"]} />
          <FooterColumn title="Company" links={["About", "Status", "Contact"]} />
        </div>
      </div>
    </footer>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mx-auto max-w-[820px] text-center">
      <p className="text-[15px] font-semibold uppercase tracking-[0.18em] text-[#8c8780]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-balance text-[40px] font-bold leading-[1.02] tracking-[-0.045em] text-black md:text-[58px]">
        {title}
      </h2>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon: Icon,
  highlight,
  video,
  poster,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  highlight?: boolean;
  video?: string;
  poster?: string;
}) {
  return (
    <article
      className={[
        "overflow-hidden rounded-[10px] bg-[#fefefe] shadow-[0_1px_1px_rgba(0,0,0,0.12),0_0_0_1px_rgba(61,59,53,0.16),0_3px_9px_rgba(61,59,53,0.08)]",
        highlight
          ? "shadow-[0_0_0_2px_rgb(248,28,229),0_0_0_4px_rgba(248,28,229,0.36)]"
          : "",
      ].join(" ")}
    >
      <div className="p-6 md:p-7">
        <span className="mb-5 grid h-11 w-11 place-items-center rounded-[9px] bg-[#f7f5ef] text-[#0070d7]">
          <Icon className="h-5 w-5" />
        </span>
        <h3 className="text-[28px] font-bold leading-[1.05] tracking-[-0.04em] text-black">
          {title}
        </h3>
        <p className="mt-3 text-[15px] leading-6 text-[#6a6861]">{description}</p>
      </div>
      {video && poster && (
        <div className="border-t border-[#ebe6de] bg-[#fbfaf7] p-4">
          <video
            className="aspect-video w-full rounded-[8px] bg-[#e8e3da] object-cover"
            src={video}
            poster={poster}
            autoPlay
            muted
            loop
            playsInline
          />
        </div>
      )}
    </article>
  );
}

function IconRow({
  title,
  body,
  icon: Icon,
}: {
  title: string;
  body: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex gap-4">
      <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-[#f7f5ef] text-[#0070d7]">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h4 className="text-[17px] font-bold tracking-[-0.025em]">{title}</h4>
        <p className="mt-1 text-[14px] leading-6 text-[#6a6861]">{body}</p>
      </div>
    </div>
  );
}

function VideoWindow({
  title,
  src,
  poster,
  caption,
  compact,
  priority,
}: {
  title: string;
  src: string;
  poster: string;
  caption?: string;
  compact?: boolean;
  priority?: boolean;
}) {
  return (
    <figure className="overflow-hidden rounded-[10px] bg-white shadow-[0_1px_1px_rgba(0,0,0,0.12),0_0_0_1px_rgba(61,59,53,0.16),0_3px_9px_rgba(61,59,53,0.08),0_18px_60px_rgba(0,0,0,0.15)]">
      <div className="flex h-11 items-center border-b border-[#ebe6de] px-4">
        <div className="flex gap-2">
          <span className="h-3 w-3 rounded-full bg-[#d9d9d9]" />
          <span className="h-3 w-3 rounded-full bg-[#d9d9d9]" />
          <span className="h-3 w-3 rounded-full bg-[#d9d9d9]" />
        </div>
        <figcaption className="mx-auto flex items-center gap-2 pr-12 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8c8780]">
          <Play className="h-3.5 w-3.5" />
          {title}
        </figcaption>
      </div>
      <video
        className={[
          "w-full bg-[#f7f5ef] object-cover",
          compact ? "aspect-[4/3]" : "aspect-video",
        ].join(" ")}
        src={src}
        poster={poster}
        autoPlay={priority}
        muted
        loop
        playsInline
        preload={priority ? "auto" : "metadata"}
      />
      {caption && (
        <p className="border-t border-[#ebe6de] bg-[#fffdf8] px-5 py-4 text-[14px] leading-6 text-[#6a6861]">
          {caption}
        </p>
      )}
    </figure>
  );
}

function Doodle({ className, text }: { className: string; text: string }) {
  return (
    <div
      className={`pointer-events-none absolute hidden rounded-[50%] border-[5px] border-[#5a5a5a] px-7 py-4 text-[34px] font-bold italic leading-none tracking-[-0.06em] text-[#5a5a5a] opacity-70 md:block ${className}`}
    >
      {text}
    </div>
  );
}

function FooterColumn({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h3 className="text-[13px] font-bold uppercase tracking-[0.16em] text-[#8c8780]">{title}</h3>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link}>
            <a className="text-[#37352f] transition-colors hover:text-black" href="#product">
              {link}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
