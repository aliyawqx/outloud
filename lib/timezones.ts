// Timezone picker options with live GMT offsets, e.g. "Asia/Almaty · GMT+5".
// Name first (what people scan for), offset short - no zero padding, minutes
// only when the zone actually has them (GMT+5:30). Pure + client-safe; offsets
// are computed for "now" so DST is reflected.

export type TzOption = { value: string; label: string; offsetMin: number }

function offsetParts(tz: string, now: Date): { text: string; minutes: number } {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
    .formatToParts(now)
    .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(part)
  if (!m) return { text: 'GMT+0', minutes: 0 }
  const sign = m[1] === '-' ? -1 : 1
  const minutes = sign * (Number(m[2]) * 60 + Number(m[3] ?? 0))
  const mm = m[3] && m[3] !== '00' ? `:${m[3]}` : ''
  return { text: `GMT${m[1]}${Number(m[2])}${mm}`, minutes }
}

/** All IANA zones as options, sorted by offset then name. */
export function timezoneOptions(now = new Date()): TzOption[] {
  return Intl.supportedValuesOf('timeZone')
    .map((tz) => {
      const { text, minutes } = offsetParts(tz, now)
      return { value: tz, label: `${tz.replace(/_/g, ' ')} · ${text}`, offsetMin: minutes }
    })
    .sort((a, b) => a.offsetMin - b.offsetMin || a.value.localeCompare(b.value))
}

/** The browser's own IANA zone ('' when unavailable). */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
  } catch {
    return ''
  }
}
