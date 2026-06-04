import { VoiceStudio } from '@/components/voice/VoiceStudio'
import { ScrollReveal } from '@/components/ScrollReveal'

export const metadata = { title: 'Outloud | Voices' }

export default function VoicesPage() {
  return (
    <div className="mx-auto max-w-container-max">
      <div className="mb-8">
        <div className="mb-3 font-code-label text-code-label uppercase tracking-widest text-cyber-lime">
          0x03 // VOICE INSPIRATION
        </div>
        <h1 className="mb-3 font-headline-xl text-headline-xl">Build your voice.</h1>
        <p className="max-w-2xl font-body-md text-body-md text-on-surface-variant">
          Pick the creators whose style you admire and we blend them into one hybrid voice that’s yours. Inspiration
          only — your posts stay about your ideas, in your blended style.
        </p>
      </div>
      <VoiceStudio />
      <ScrollReveal />
    </div>
  )
}
