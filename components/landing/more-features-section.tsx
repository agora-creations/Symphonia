import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { moreFeatures, type MoreFeature } from "@/components/landing/landing-data";

/** Collects the smaller feature notes that mirror Bear's deeper feature grid. */
export function MoreFeaturesSection() {
  return (
    <section className="border-y border-[var(--landing-line)] bg-[var(--landing-cream)] px-5 py-16 md:py-24">
      <div className="mx-auto max-w-[1180px]">
        <div className="max-w-[680px]">
          <p className="mb-5 text-[14px] font-semibold uppercase text-[var(--landing-orange)]">
            And so much more
          </p>
          <h2 className="text-balance text-[42px] font-semibold leading-[1.02] md:text-[64px]">
            Advanced orchestration that reveals itself naturally.
          </h2>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <SyncPanel />
          <div className="grid gap-5 sm:grid-cols-2">
            {moreFeatures.map((feature) => (
              <MoreFeatureCard key={feature.title} feature={feature} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Highlights continuous execution with the wide server-room illustration. */
function SyncPanel() {
  return (
    <article className="overflow-hidden rounded-[8px] border border-[var(--landing-line)] bg-[var(--landing-paper)]">
      <Image
        src="/images/server-room.png"
        alt="Minimal line illustration of cloud infrastructure."
        width={2064}
        height={512}
        className="h-auto w-full"
        sizes="(max-width: 1024px) 94vw, 590px"
      />
      <div className="px-6 pb-7">
        <p className="text-[13px] font-semibold uppercase text-[var(--landing-orange)]">
          Continuous Agent Execution
        </p>
        <h3 className="mt-3 text-[30px] font-semibold leading-tight">
          Runs keep moving while review stays human.
        </h3>
        <p className="mt-4 text-[16px] leading-7 text-[var(--landing-muted)]">
          Progress syncs across the workspace in real time, then resolves into
          evidence a reviewer can actually use.
        </p>
      </div>
    </article>
  );
}

/** Shows a compact secondary capability with the same quiet card treatment. */
function MoreFeatureCard({ feature }: { feature: MoreFeature }) {
  return (
    <article className="rounded-[8px] border border-[var(--landing-line)] bg-[var(--landing-paper)] p-6">
      <div className="mb-8 flex items-center justify-between gap-4">
        <span className="text-[13px] font-semibold uppercase text-[var(--landing-orange)]">
          {feature.label ?? "PRO"}
        </span>
        <ArrowUpRight className="h-4 w-4 text-[var(--landing-muted)]" />
      </div>
      <h3 className="text-[24px] font-semibold leading-tight">{feature.title}</h3>
      <p className="mt-4 text-[15px] leading-7 text-[var(--landing-muted)]">{feature.body}</p>
    </article>
  );
}
