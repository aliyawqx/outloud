export function Logo({ wordClass = 'text-headline-lg' }: { wordClass?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mascot.svg" alt="" className="h-9 w-9 shrink-0" />
      <span className={`font-headline-lg ${wordClass} font-bold text-on-surface`}>Outloud</span>
    </span>
  )
}
