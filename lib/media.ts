// Public URL of the onboarding/demo clip. Served as a static asset: the file is
// gitignored (media stays out of the repo) but explicitly UN-ignored in
// .vercelignore so it ships with the deploy. Single source of truth for both the
// landing hero and the in-app intro overlay. To swap the clip, drop the new file
// under public/demo/ with a NEW versioned name (busts CDN + browser caches),
// update this path, and regenerate public/intro-poster.jpg from its first frame.
export const INTRO_VIDEO_URL = '/demo/intro-v2.mp4'
