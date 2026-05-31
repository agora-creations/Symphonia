import Image from "next/image";
import { Check } from "lucide-react";
import { features, type LandingFeature } from "@/components/landing/landing-data";

/** Renders the mapped Bear feature sections with Symphonia-specific content. */
export function FeatureSections() {
  return (
    <section id="features" className="bg-[var(--landing-paper)]">
      <IntroBlock />
      <div id="workflow" className="mx-auto flex max-w-[1180px] flex-col gap-4 px-5 pb-16 md:pb-24">
        {features.map((feature) => (
          <FeaturePanel key={feature.title} feature={feature} />
        ))}
      </div>
    </section>
  );
}

/** Introduces the feature story before the larger alternating panels begin. */
function IntroBlock() {
  return (
    <div className="mx-auto max-w-[760px] px-5 py-16 text-center md:py-24">
      <p className="mb-5 text-[14px] font-semibold uppercase text-[var(--landing-blue)]">
        Write naturally
      </p>
      <h2 className="text-balance text-[42px] font-semibold leading-[1.02] md:text-[68px]">
        Specs, branches, runs, and reviews stay in rhythm.
      </h2>
      <p className="mx-auto mt-6 max-w-[620px] text-[18px] leading-8 text-[var(--landing-muted)]">
        Bear makes notes feel simple without hiding power. Symphonia brings that
        same calm structure to AI-development orchestration.
      </p>
    </div>
  );
}

/** Displays one image-led feature section with bullets and generous whitespace. */
function FeaturePanel({ feature }: { feature: LandingFeature }) {
  return (
    <article className="grid items-center gap-8 border-t border-[var(--landing-line)] py-12 md:grid-cols-2 md:py-16">
      <div className={feature.reverse ? "md:order-2" : ""}>
        <p className="text-[14px] font-semibold uppercase text-[var(--landing-blue)]">
          {feature.eyebrow}
        </p>
        <h3 className="mt-4 max-w-[560px] text-balance text-[34px] font-semibold leading-[1.06] md:text-[52px]">
          {feature.title}
        </h3>
        <p className="mt-5 max-w-[560px] text-[17px] leading-8 text-[var(--landing-muted)]">
          {feature.body}
        </p>
        <ul className="mt-7 space-y-3">
          {feature.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-3 text-[15px] leading-6 text-[var(--landing-muted)]">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-[var(--landing-blue)]" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="overflow-hidden rounded-[8px] border border-[var(--landing-line)] bg-[var(--landing-soft)]">
        <Image
          src={feature.image}
          alt={feature.imageAlt}
          width={feature.imageWidth}
          height={feature.imageHeight}
          className="h-auto w-full"
          sizes="(max-width: 768px) 94vw, 560px"
        />
      </div>
    </article>
  );
}
