// Public URL of the onboarding/demo clip. Served as a static asset: the file is
// gitignored (media stays out of the repo) but explicitly UN-ignored in
// .vercelignore so it ships with the deploy. Single source of truth for both the
// landing hero and the in-app intro overlay. To swap the clip, drop the new file
// under public/demo/ with a NEW versioned name (busts CDN + browser caches),
// update this path, and regenerate public/intro-poster.jpg from its first frame.
// Hosted on Vercel Blob - the clip CANNOT ship inside the deploy: Vercel CLI
// honors .gitignore's *.mp4 exclusion, so a public/ mp4 silently 404s in prod
// (this bit us twice). Refresh by running scripts/upload-intro.ts and keeping
// this URL in sync with what it prints.
export const INTRO_VIDEO_URL = 'https://lgucdhdm6methfcr.public.blob.vercel-storage.com/demo/intro-v2.mp4'
