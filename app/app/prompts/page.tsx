import { getSession } from '@/lib/auth/session'
import { listPrompts } from '@/lib/prompts/store'
import { PromptsManager } from '@/components/app/PromptsManager'

export const metadata = { title: 'Outloud | Prompts' }

export default async function PromptsPage() {
  const session = await getSession()
  if (!session) return null // layout guards auth

  const prompts = await listPrompts(session.userId)

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 font-headline-xl text-headline-xl">Prompts</h1>
      <p className="mb-8 font-body-md text-body-md text-on-surface-variant">
        Format commands for the composer. Each controls the structure of an output type; your voice
        still handles the tone.
      </p>
      <PromptsManager initial={prompts} />
    </div>
  )
}
