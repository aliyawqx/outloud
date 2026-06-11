export function Logo({
  wordClass = 'text-headline-lg',
  iconClass = 'h-9 w-9',
}: {
  wordClass?: string
  iconClass?: string
}) {
  return (
    <span className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mascot.svg" alt="" className={`${iconClass} shrink-0`} />
      <span className={`font-headline-lg ${wordClass} font-bold text-on-surface`}>Outloud</span>
    </span>
  )
}
