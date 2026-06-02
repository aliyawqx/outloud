export function Logo({ wordClass = 'text-headline-lg' }: { wordClass?: string }) {
  return (
    <span className="flex items-center gap-3">
      <span className="relative grid h-7 w-7 place-items-center">
        <span className="absolute inset-0 rounded-full border-2 border-electric-indigo" />
        <span className="h-2 w-2 rounded-full bg-electric-indigo" />
      </span>
      <span className={`font-headline-lg ${wordClass} font-bold text-on-surface`}>Outloud</span>
    </span>
  )
}
