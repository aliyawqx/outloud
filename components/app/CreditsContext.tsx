'use client'

import { createContext, useContext, useState } from 'react'

// Live credit balance shared between the sidebar header and the composer/reply
// views, so sending a post/reply updates the header without a page reload. Seeded
// from the server, then reconciled with the balance each send response returns.
type CreditsCtx = { balance: number; unlimited: boolean; setBalance: (n: number) => void }

const Ctx = createContext<CreditsCtx | null>(null)

export function CreditsProvider({
  initialBalance,
  unlimited = false,
  children,
}: {
  initialBalance: number
  unlimited?: boolean
  children: React.ReactNode
}) {
  const [balance, setBalance] = useState(initialBalance)
  return <Ctx.Provider value={{ balance, unlimited, setBalance }}>{children}</Ctx.Provider>
}

/** Safe outside a provider (returns a no-op) so components don't crash in isolation. */
export function useCredits(): CreditsCtx {
  return useContext(Ctx) ?? { balance: 0, unlimited: false, setBalance: () => {} }
}
