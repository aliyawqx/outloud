// Onboarding tour definitions. Each step targets a real element via a data-tour
// hook (or no element = a centered welcome modal). Copy is short + lowercase to
// match the brand voice. Steps whose target isn't present/visible are filtered out
// at run time, so conditionally-rendered targets (publish, etc.) degrade cleanly.

export type TourKey = 'welcome' | 'new_post' | 'new_reply' | 'profile' | 'billing' | 'voices'

export type TourStep = {
  element?: string
  title: string
  description: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  /** Route this step lives on. When it differs from the current page, the tour
   *  navigates there first (and the overlay keeps the user on rails). Omit for steps
   *  on the tour's own page. */
  route?: string
}

export const ALL_TOURS: TourKey[] = ['welcome', 'new_post', 'new_reply', 'profile', 'billing', 'voices']

export const TOURS: Record<TourKey, TourStep[]> = {
  // Global first-login pass over the core loop.
  welcome: [
    {
      route: '/app',
      title: 'welcome to outloud',
      description: 'it drafts posts + replies in your real voice — not generic ai. here’s the 30-second tour.',
    },
    {
      route: '/app',
      element: '[data-tour="voice-picker"]',
      title: 'your voice',
      description: 'pick or capture a voice. this is what makes posts sound like you, not generic ai.',
      side: 'top',
    },
    {
      route: '/app',
      element: '[data-tour="composer"]',
      title: 'compose',
      description: 'drop a rough idea here — outloud asks what it needs, then writes it in your voice.',
      side: 'top',
    },
    {
      route: '/app',
      element: '[data-tour="new-post"]',
      title: 'one post = one chat',
      description: 'each post lives in its own chat. start a new chat for every post so credits go to drafting, not old context.',
      side: 'right',
    },
    {
      // Navigates to the profile page and shows the card there — the rest of the app
      // stays locked behind the overlay while the tour drives.
      route: '/app/profile',
      element: '[data-tour="connections"]',
      title: 'connect & publish',
      description: 'connect x / threads here — then you can publish any draft in a click.',
      side: 'bottom',
    },
    {
      // Back to the composer to finish at home base, ready to post.
      route: '/app',
      element: '[data-tour="composer"]',
      title: 'you’re all set',
      description: 'drop your first idea here and outloud writes it in your voice. enjoy 🎉',
      side: 'top',
    },
  ],

  // Per-page tours (first visit each).
  new_post: [
    { element: '[data-tour="composer"]', title: 'draft a post', description: 'type a rough idea — outloud writes it in your voice.', side: 'top' },
    { element: '[data-tour="voice-picker"]', title: 'voice for this post', description: 'switch the voice this post is written in.', side: 'top' },
    { element: '[data-tour="mode-picker"]', title: 'format', description: 'pick a format — thread, hot take, and more.', side: 'top' },
    { element: '[data-tour="new-post"]', title: 'new chat per post', description: 'finished one? start a new chat for the next post so credits stay on drafting.', side: 'right' },
  ],
  new_reply: [
    { element: '[data-tour="reply-source"]', title: 'pick a post', description: 'paste a link to the post you want to reply to.', side: 'bottom' },
    { element: '[data-tour="voice-picker"]', title: 'your voice, on replies', description: 'your captured voice applies to replies too.', side: 'bottom' },
    { element: '[data-tour="reply-write"]', title: 'grow by replying', description: 'replies are how you grow — engage bigger accounts in your niche.', side: 'top' },
    { element: '[data-tour="publish"]', title: 'publish', description: 'post the reply straight to the original.', side: 'top' },
  ],
  profile: [
    { element: '[data-tour="connections"]', title: 'connected accounts', description: 'connect x and threads here so you can publish.', side: 'bottom' },
    { element: '[data-tour="account-settings"]', title: 'your details', description: 'name, handle and avatar live here.', side: 'bottom' },
    { element: '[data-tour="replay-tours"]', title: 'replay tours', description: 'want a refresher? replay any tour from here anytime.', side: 'top' },
  ],
  billing: [
    { element: '[data-tour="credit-balance"]', title: 'your balance', description: 'credits left this cycle + any top-ups.', side: 'bottom' },
    { element: '[data-tour="usage-history"]', title: 'where credits go', description: 'a per-entry log — credits are only spent on drafting, per chat.', side: 'top' },
    { element: '[data-tour="plans-topups"]', title: 'plans & top-ups', description: 'upgrade your plan or add one-time credit packs here.', side: 'top' },
  ],
  voices: [
    { element: '[data-tour="voice-library"]', title: 'voice library', description: 'blend real creators into one voice that’s yours.', side: 'right' },
    { element: '[data-tour="capture-own"]', title: 'capture your own', description: 'or capture your own voice from things you’ve written.', side: 'bottom' },
    { element: '[data-tour="blend-save"]', title: 'save your blend', description: 'tune the mix, name it, and save — then write with it.', side: 'left' },
  ],
}

/** Which tour (if any) should fire on a route, given completion state. /app staggers:
 *  the global welcome first, then the new-post tour on a later visit. */
export function tourForRoute(pathname: string, done: Record<string, boolean>): TourKey | null {
  if (pathname === '/app') return !done.welcome ? 'welcome' : !done.new_post ? 'new_post' : null
  if (pathname.startsWith('/app/reply')) return !done.new_reply ? 'new_reply' : null
  if (pathname.startsWith('/app/settings/billing')) return !done.billing ? 'billing' : null
  if (pathname === '/app/voices') return !done.voices ? 'voices' : null
  // /app/profile (but not /app/profile/usage, which has no tour of its own)
  if (pathname === '/app/profile') return !done.profile ? 'profile' : null
  return null
}
