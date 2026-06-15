# Outloud search worker

Anonymous tweet search for Reply Studio (Mode B), so the official X API isn't used
for discovery. A tiny FastAPI service that scrapes a **Nitter** instance and returns
results in the shape the Next.js app expects. The app calls it when
`X_SEARCH_WORKER_URL` is set; otherwise it falls back to the official X API.

> ⚠️ This is best-effort and against X's ToS. It depends on a working Nitter
> instance (public ones are unstable / rate-limited; self-hosting needs guest
> tokens). It scrapes from the **server's** IP, never the user's X account — so it
> can't get a user account banned, but the worker's IP can get rate-limited. For
> reliability, the official API search is the safe path.

## Endpoints

- `GET /health` → `{ ok, nitter }`
- `GET /search?q=<topic>&hours=24&limit=50` → `{ "posts": [ … ] }`  (Mode B discovery)
  - send `Authorization: Bearer <WORKER_TOKEN>` if a token is configured
  - each post: `{ id, url, authorHandle, authorName, followers, text, createdAt, likes, replies, reposts, quotes }`
  - `followers` is `0` (not on the search page) — ranking leans on engagement.

## Env

| var | default | meaning |
|---|---|---|
| `NITTER_BASE` | `https://nitter.net` | Nitter instance to scrape (use your own for reliability) |
| `WORKER_TOKEN` | _(empty)_ | if set, callers must send `Authorization: Bearer <token>` |
| `MIN_INTERVAL_S` | `2.0` | minimum gap between upstream calls (anti-burst) |
| `CACHE_TTL_S` | `300` | per-query cache TTL |
| `REQUEST_TIMEOUT_S` | `15` | upstream timeout |
| `USER_AGENT` | a desktop Chrome UA | sent to Nitter |

## Run locally

```bash
cd worker
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
curl "http://localhost:8080/search?q=build%20in%20public&hours=24&limit=20"
```

## Deploy on Railway

1. New Project → Deploy from this repo → set **root directory** to `worker/`
   (Railway auto-detects the Dockerfile).
2. Set env vars: `NITTER_BASE` (your instance), `WORKER_TOKEN` (a random secret).
3. After deploy, copy the public URL.

## Wire it into the app

In the **Next.js app's** env (Vercel + `.env.local`):

```
X_SEARCH_WORKER_URL=https://<your-worker>.up.railway.app
X_SEARCH_WORKER_TOKEN=<same WORKER_TOKEN>
```

The app immediately routes Mode B search through the worker (and keeps the official
API as the fallback when the var is unset). Mode A (single-post read) already runs
through FxTwitter, no worker needed.
