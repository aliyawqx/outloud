# Cron setup (scheduling + autopilot)

The app has two cron endpoints, both gated by `Authorization: Bearer $CRON_SECRET`:

| Endpoint | What it does | Suggested cadence |
| --- | --- | --- |
| `GET /api/cron/publish` | Publishes due scheduled posts (atomic claim, max 10/run, ≤2 retries) | every 1–5 min |
| `GET /api/cron/generate` | Autopilot fills upcoming empty slots (≤3 generations/run) | every 5–15 min |

Vercel plan is **Hobby** → Vercel Cron can only fire once a day, so the triggers are external.

## Primary: cron-job.org (per-minute precision)

1. Create an account at cron-job.org.
2. Add job 1: URL `https://<prod-domain>/api/cron/publish`, schedule every 1 min (or 2 min),
   request method GET, add header `Authorization: Bearer <CRON_SECRET>`, timeout 60s.
3. Add job 2: same, URL `.../api/cron/generate`, schedule every 15 min.

## Fallback: GitHub Actions

`.github/workflows/cron.yml` calls both endpoints every 5 minutes. Set repo secrets
`APP_URL` and `CRON_SECRET`. Note: Actions schedules can lag 3–15 min — fine for
generation, coarse for publishing. Keep cron-job.org as the primary publish trigger.

## Env

- `CRON_SECRET` — long random hex; set in `.env.local`, Vercel project env (Production),
  GitHub repo secrets, and the cron-job.org header. Rotate everywhere at once.
- LinkedIn (see `.env.example`): `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`,
  `LINKEDIN_REDIRECT_URI` (register the prod HTTPS URI on the app's Auth tab),
  `LINKEDIN_API_VERSION` (YYYYMM, bump ~yearly), `LINKEDIN_TOKEN_ENC_KEY` (32 bytes base64),
  optional `LINKEDIN_FORCE_UGC=1` to pin the /v2/ugcPosts fallback.

## Upgrade path (not built)

If per-post timing precision ever matters, swap the publish scan for QStash (Upstash)
callbacks scheduled at the exact publish moment: the callback claims the post
(`claimForPublishing`) and calls `publishScheduledPost` — the executor is already
single-post callable, so only the trigger changes.

## Prod rollout checklist

1. Run the schema once against prod: `DATABASE_URL=<prod> npx tsx scripts/sync-schema.ts`
   (`DB_SKIP_SCHEMA=1` means it will NOT self-apply).
2. Set `CRON_SECRET` in Vercel env.
3. `vercel --prod` (manual deploy — this repo does not auto-deploy from git).
4. Create the two cron-job.org jobs; set the GitHub secrets.
5. Fire both endpoints once with curl against prod and check the JSON summaries.
