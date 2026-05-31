import Link from "next/link";
import { Check } from "lucide-react";

const freeItems = ["Connect one repository", "Plan tasks and milestones", "Review local evidence"];

const proItems = [
  "Unlimited repositories",
  "Background agent execution",
  "Branch-aware review handoffs",
  "Shared team workspace",
];

/** Presents Bear-style pricing cards adapted to Symphonia's product tiers. */
export function PricingSection() {
  return (
    <section id="pricing" className="bg-[var(--landing-paper)] px-5 py-16 md:py-24">
      <div className="mx-auto max-w-[980px] text-center">
        <p className="mb-5 text-[14px] font-semibold uppercase text-[var(--landing-blue)]">
          Price
        </p>
        <h2 className="text-balance text-[42px] font-semibold leading-[1.02] md:text-[64px]">
          Start calmly, scale when the team is ready.
        </h2>
      </div>
      <div className="mx-auto mt-12 grid max-w-[980px] gap-5 md:grid-cols-2">
        <PriceCard title="Free" price="$0" items={freeItems} />
        <PriceCard title="Symphonia" price="$29" items={proItems} featured />
      </div>
    </section>
  );
}

/** Displays one pricing option with a clear call to action. */
function PriceCard({
  title,
  price,
  items,
  featured,
}: {
  title: string;
  price: string;
  items: string[];
  featured?: boolean;
}) {
  return (
    <article
      className={[
        "rounded-[8px] border p-7 text-left",
        featured
          ? "border-[var(--landing-blue)] bg-[var(--landing-cream)]"
          : "border-[var(--landing-line)] bg-[var(--landing-paper)]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[15px] font-semibold text-[var(--landing-muted)]">{title}</p>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-[54px] font-semibold leading-none">{price}</span>
            <span className="pb-2 text-[15px] text-[var(--landing-muted)]">/ month</span>
          </div>
        </div>
        {featured && (
          <span className="rounded-full bg-[var(--landing-blue)] px-3 py-1 text-[12px] font-semibold text-white">
            Best fit
          </span>
        )}
      </div>
      <ul className="mt-8 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-[15px] leading-6 text-[var(--landing-muted)]">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-[var(--landing-blue)]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex h-11 items-center justify-center rounded-full bg-[var(--landing-ink)] px-5 text-[15px] font-semibold text-white transition hover:bg-[var(--landing-blue-dark)]"
      >
        Connect repository
      </Link>
    </article>
  );
}
