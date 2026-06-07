import { getSession } from '@/lib/auth/session'
import { listPrompts } from '@/lib/prompts/store'
import { SEED_PROMPTS } from '@/lib/prompts/seeds'
import { PromptsManager } from '@/components/app/PromptsManager'

export const metadata = { title: 'Outloud | Prompts' }

export default async function PromptsPage() {
  const session = await getSession()
  if (!session) return null // layout guards auth

  const custom = await listPrompts(session.userId)
  const defaults = SEED_PROMPTS.map((s) => ({ command: s.command, title: s.title, text: s.text }))

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 font-headline-xl text-headline-xl">Prompts</h1>
      <p className="mb-8 font-body-md text-body-md text-on-surface-variant">
        Format commands for the composer. Each controls the structure of an output type; your voice
        still handles the tone.
      </p>
      <PromptsManager defaults={defaults} initialCustom={custom} />
    </div>
  )
}
