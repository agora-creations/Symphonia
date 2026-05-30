import Link from "next/link";
import { footerGroups } from "@/components/landing/landing-data";

/** Provides the final navigation and product summary at the bottom of the page. */
export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--landing-line)] bg-[var(--landing-paper)] px-5 py-12">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-10 md:flex-row md:justify-between">
        <div>
          <Link href="/" className="font-serif text-[30px] font-semibold text-[var(--landing-ink)]">
            Symphonia
          </Link>
          <p className="mt-3 max-w-[360px] text-[15px] leading-7 text-[var(--landing-muted)]">
            The AI-developer orchestration workspace where specs become reviewed code.
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {footerGroups.map((group) => (
            <FooterColumn key={group.title} title={group.title} links={group.links} />
          ))}
        </div>
      </div>
    </footer>
  );
}

/** Lists one footer group using simple anchor links. */
function FooterColumn({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h3 className="text-[13px] font-semibold uppercase text-[var(--landing-muted)]">
        {title}
      </h3>
      <ul className="mt-4 space-y-3 text-[15px] text-[var(--landing-muted)]">
        {links.map((link) => (
          <li key={link}>
            <a className="transition hover:text-[var(--landing-ink)]" href="#features">
              {link}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
