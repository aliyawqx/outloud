import { ScrollReveal } from '@/components/ScrollReveal'
import { Pricing } from '@/components/Pricing'
import { TrialBanner } from '@/components/TrialBanner'
import { SiteNav } from '@/components/landing/SiteNav'
import { Hero } from '@/components/landing/Hero'
import { Highlights } from '@/components/landing/Highlights'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { FeaturesDark } from '@/components/landing/FeaturesDark'
import { Showcase } from '@/components/landing/Showcase'
import { Faq } from '@/components/landing/Faq'
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
        <HowItWorks />
        <FeaturesDark />
        <Showcase />
        <div className="reveal">
          <Pricing condensed />
        </div>
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
      <ScrollReveal />
    </>
  )
}
