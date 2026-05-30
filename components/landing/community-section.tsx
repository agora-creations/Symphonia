import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

/** Closes the landing story with community proof and a repository CTA. */
export function CommunitySection() {
  return (
    <section id="community" className="overflow-hidden bg-[var(--landing-cream)] px-5 py-16 md:py-24">
      <div className="mx-auto grid max-w-[1180px] items-center gap-10 md:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="mb-5 text-[14px] font-semibold uppercase text-[var(--landing-orange)]">
            Join the community
          </p>
          <h2 className="text-balance text-[42px] font-semibold leading-[1.02] md:text-[64px]">
            Build with agents without losing the thread.
          </h2>
          <p className="mt-6 max-w-[560px] text-[18px] leading-8 text-[var(--landing-muted)]">
            Symphonia gives founders, engineers, and reviewers a shared place
            to turn intent into reviewed implementation.
          </p>
          <Link
            href="/dashboard"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-[var(--landing-orange)] px-6 text-[16px] font-semibold text-white transition hover:bg-[var(--landing-orange-dark)]"
          >
            Connect repository
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="rounded-[8px] border border-[var(--landing-line)] bg-[var(--landing-paper)]">
          <Image
            src="/images/symphonia-hero.png"
            alt="Minimal line illustration of a Symphonia developer workspace."
            width={1376}
            height={768}
            className="h-auto w-full"
            sizes="(max-width: 768px) 94vw, 560px"
          />
        </div>
      </div>
    </section>
  );
}
