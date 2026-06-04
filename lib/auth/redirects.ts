// Shared post-auth destinations (kept in one place so pages, middleware, and
// tests agree). New users go into voice onboarding first; returning users land
// on the compose home.
export const AFTER_SIGNUP = '/app/voices'
export const AFTER_LOGIN = '/app'
export const SIGNUP_PATH = '/signup'
export const LOGIN_PATH = '/login'
