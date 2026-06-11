import { ScrollReveal } from '@/components/ScrollReveal'
import { Pricing } from '@/components/Pricing'
import { TrialBanner } from '@/components/TrialBanner'
import { SiteNav } from '@/components/landing/SiteNav'
import { Hero } from '@/components/landing/Hero'
import { Highlights } from '@/components/landing/Highlights'
import { FeaturesDark } from '@/components/landing/FeaturesDark'
import { Showcase } from '@/components/landing/Showcase'
import { FinalCta } from '@/components/landing/FinalCta'
import { SiteFooter } from '@/components/landing/SiteFooter'

export default function Page() {
  return (
    <>
      <TrialBanner />
      <SiteNav />
      <main>
        <Hero />
        <Highlights />
        <FeaturesDark />
        <Showcase />
        <div className="reveal">
          <Pricing condensed />
        </div>
        <FinalCta />
      </main>
      <SiteFooter />
      <ScrollReveal />
    </>
  )
}
