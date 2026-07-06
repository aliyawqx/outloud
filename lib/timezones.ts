// Timezone picker options with live GMT offsets, e.g. "(GMT+05:00) Asia/Almaty".
// Pure + client-safe; offsets are computed for "now" so DST is reflected.

export type TzOption = { value: string; label: string; offsetMin: number }

function offsetParts(tz: string, now: Date): { text: string; minutes: number } {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
    .formatToParts(now)
    .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(part)
  if (!m) return { text: 'GMT+00:00', minutes: 0 }
  const sign = m[1] === '-' ? -1 : 1
  const minutes = sign * (Number(m[2]) * 60 + Number(m[3] ?? 0))
  const hh = String(Number(m[2])).padStart(2, '0')
  const mm = m[3] ?? '00'
  return { text: `GMT${m[1]}${hh}:${mm}`, minutes }
}

/** All IANA zones as options, sorted by offset then name. */
export function timezoneOptions(now = new Date()): TzOption[] {
  return Intl.supportedValuesOf('timeZone')
    .map((tz) => {
      const { text, minutes } = offsetParts(tz, now)
      return { value: tz, label: `(${text}) ${tz.replace(/_/g, ' ')}`, offsetMin: minutes }
    })
    .sort((a, b) => a.offsetMin - b.offsetMin || a.value.localeCompare(b.value))
}
