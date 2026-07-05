import { CalendarView } from '@/components/app/calendar/CalendarView'

export const metadata = { title: 'Calendar — Outloud' }

export default function CalendarPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6">
        <h1 className="font-headline-lg text-headline-lg">Calendar</h1>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          Everything queued to publish — your scheduled posts and autopilot&apos;s, side by side.
        </p>
      </div>
      <CalendarView />
    </div>
  )
}
