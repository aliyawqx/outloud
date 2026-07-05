// Both cron routes are gated by a bearer secret (spec §6/§14). The external
// trigger (cron-job.org / GitHub Actions) must send:
//   Authorization: Bearer $CRON_SECRET
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // unset secret = closed, never open
  return req.headers.get('authorization') === `Bearer ${secret}`
}
