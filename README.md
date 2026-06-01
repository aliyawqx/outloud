# Outloud — Landing Page

AI build-in-public copilot that turns what you ship into X posts in your own voice — not
generic AI mush. This repo is the landing page + waitlist (email + willingness-to-pay).

## Stack

- Next.js 15 (App Router, TypeScript)
- Tailwind CSS (dark, X-native theme)
- Postgres (`pg`) for the waitlist
- Vitest for unit tests

## Run locally

```bash
npm install
cp .env.example .env        # set DATABASE_URL to a local Postgres
npm run dev                 # http://localhost:3000
```

The `waitlist_signups` table is created automatically on the first API request
(`ensureSchema()` runs `db/schema.sql`).

## Test

```bash
npm test
```

## Waitlist API

`POST /api/waitlist`

```json
{ "email": "you@startup.com", "willingnessToPay": 50 }
```

`willingnessToPay` must be one of `0, 10, 50, 100, 101` (101 = "$100+").
Duplicate emails upsert (update the willingness) and respond with `{ ok: true, alreadyOnList: true }`.

## Deploy on Railway

1. Create a new Railway project from this repo.
2. Add the **Postgres** plugin — Railway injects `DATABASE_URL` automatically.
3. Build command: `npm run build`. Start command: `npm start`.
4. Deploy. The schema is created on first signup.

## Read signups

Until there's an admin view, query Railway Postgres directly:

```sql
SELECT email, willingness_to_pay, referrer, created_at
FROM waitlist_signups
ORDER BY created_at DESC;
```
