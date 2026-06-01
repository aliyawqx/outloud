import { Nav } from '@/components/Nav'
import { Hero } from '@/components/Hero'
import { Problem } from '@/components/Problem'
import { How } from '@/components/How'
import { Differentiation } from '@/components/Differentiation'
import { Claim } from '@/components/Claim'
import { Footer } from '@/components/Footer'

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Problem />
        <How />
        <Differentiation />
        <Claim />
        <Footer />
      </main>
    </>
  )
}
