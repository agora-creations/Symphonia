import Link from "next/link";
import { Github } from "lucide-react";
import { navItems } from "@/components/landing/landing-data";

/** Keeps the primary navigation fixed in view without covering the page content. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--landing-line)] bg-[var(--landing-paper)]/92 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-[1180px] items-center justify-between px-5">
        <Link
          href="/"
          className="font-serif text-[30px] font-semibold leading-none text-[var(--landing-ink)]"
          aria-label="Symphonia home"
        >
          Symphonia
        </Link>
        <nav className="hidden items-center gap-8 text-[15px] text-[var(--landing-muted)] md:flex">
          {navItems.map((item) => (
            <a key={item.href} className="transition hover:text-[var(--landing-ink)]" href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--landing-orange)] px-5 text-[15px] font-semibold text-white shadow-[0_10px_24px_rgba(217,111,36,0.24)] transition hover:bg-[var(--landing-orange-dark)]"
        >
          <Github className="h-4 w-4" />
          Connect repo
        </Link>
      </div>
    </header>
  );
}
