// Public URL of the onboarding/demo clip. Served as a static asset: the file is
// gitignored (media stays out of the repo) but explicitly UN-ignored in
// .vercelignore so it ships with the deploy. Single source of truth for both the
// landing hero and the in-app intro overlay. To swap the clip, drop the new file
// under public/demo/ with a NEW versioned name (busts CDN + browser caches),
// update this path, and regenerate public/intro-poster.jpg from its first frame.
// The 4K original (41MB): the 1080p transcode (promo/intro-v3-1080p.mp4) played
// badly in prod, so it's parked until that's understood - size alone isn't
// worth a broken player.
export const INTRO_VIDEO_URL = '/demo/intro-v2.mp4'
