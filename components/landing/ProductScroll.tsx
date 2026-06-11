import { ContainerScroll } from '@/components/ui/container-scroll-animation'
import { AppShot } from './AppShot'

// Premium scroll reveal of the product: the app tilts in 3D and flattens as you
// scroll past it (Aceternity ContainerScroll), filled with our real app UI.
export function ProductScroll() {
  return (
    <section className="-mt-10 overflow-hidden">
      <ContainerScroll
        titleComponent={
          <div className="pb-2">
            <p className="mb-2 font-code-label text-code-label uppercase tracking-widest text-electric-indigo">See it work</p>
            <h2 className="font-headline-xl text-headline-xl">
              Your idea, a post in your{' '}
              <span className="bg-gradient-to-r from-electric-indigo to-secondary bg-clip-text text-transparent">voice</span>.
            </h2>
          </div>
        }
      >
        <AppShot />
      </ContainerScroll>
    </section>
  )
}
