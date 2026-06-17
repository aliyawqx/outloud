'use client'

import { useEffect, useState } from 'react'
import { Spinner } from '@/components/Spinner'

type Usage = {
  balance: number
  allowance: number
  monthUsed: number
  daily: { date: string; used: number }[]
}

const fmt = (n: number) => n.toLocaleString()
// "2026-06-17" → "Jun 17"
function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function UsagePanel() {
  const [usage, setUsage] = useState<Usage | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/credits/usage')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then(setUsage)
      .catch(() => setError('Could not load usage right now.'))
  }, [])

  if (error) return <p className="font-body-sm text-body-sm text-error">{error}</p>
  if (!usage) return <div className="flex justify-center py-10"><Spinner size={20} className="text-electric-indigo" /></div>

  const remaining = usage.balance
  const pct = usage.allowance > 0 ? Math.min(100, Math.round((remaining / usage.allowance) * 100)) : 0
  const maxDay = Math.max(1, ...usage.daily.map((d) => d.used))

  return (
    <div className="flex flex-col gap-6">
      {/* balance vs allowance */}
      <div className="rounded-2xl border border-border-muted bg-surface-container-low p-5">
        <div className="flex items-baseline justify-between">
          <span className="font-headline-sm text-headline-sm text-on-surface">{fmt(remaining)} credits</span>
          <span className="font-code-label text-code-label text-on-surface-variant">of {fmt(usage.allowance)} / cycle</span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
          <div className="h-full rounded-full bg-electric-indigo" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-3 font-body-sm text-body-sm text-on-surface-variant">
          Used this month: <span className="text-on-surface">{fmt(usage.monthUsed)}</span> credits
        </p>
      </div>

      {/* last 7 days */}
      <div className="rounded-2xl border border-border-muted bg-surface-container-low p-5">
        <h2 className="mb-4 font-code-label text-code-label uppercase text-on-surface-variant">Last 7 days</h2>
        <div className="flex items-end justify-between gap-2" style={{ height: 120 }}>
          {usage.daily.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center justify-end gap-2">
              <span className="font-code-label text-[10px] text-on-surface-variant/70">{d.used > 0 ? fmt(d.used) : ''}</span>
              <div
                className="w-full rounded-t bg-electric-indigo/80"
                style={{ height: `${Math.round((d.used / maxDay) * 90)}%`, minHeight: d.used > 0 ? 4 : 2, opacity: d.used > 0 ? 1 : 0.25 }}
                title={`${dayLabel(d.date)}: ${fmt(d.used)} credits`}
              />
              <span className="font-code-label text-[10px] text-on-surface-variant/60">{dayLabel(d.date)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
