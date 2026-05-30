import { CommunitySection } from "@/components/landing/community-section";
import { FeatureSections } from "@/components/landing/feature-sections";
import { HeroSection } from "@/components/landing/hero-section";
import { MoreFeaturesSection } from "@/components/landing/more-features-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";

/** Shows the public Symphonia landing page using the Bear-style layout system. */
export default function Home() {
  return (
    <main className="landing-page min-h-screen bg-[var(--landing-cream)] font-sans text-[var(--landing-ink)]">
      <SiteHeader />
      <HeroSection />
      <FeatureSections />
      <MoreFeaturesSection />
      <PricingSection />
      <CommunitySection />
      <SiteFooter />
    </main>
  );
}
