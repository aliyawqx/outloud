"""
Outloud search worker — anonymous tweet search for Reply Studio (Mode B).

Replaces the official X API search with a self-hosted scrape via a Nitter instance,
so the user's X account is never used to read (it can't get flagged). The Next.js
app calls GET /search; set X_SEARCH_WORKER_URL in the app to this service's URL.

Contract the app expects (lib/x/search.ts -> searchViaWorker):
  GET /search?q=<topic>&hours=<int>&limit=<int>   [Authorization: Bearer <token>]
  -> { "posts": [ {
         "id": str, "url": str, "authorHandle": str, "authorName": str,
         "followers": int, "text": str, "createdAt": ISO8601,
         "likes": int, "replies": int, "reposts": int, "quotes": int
       }, ... ] }

Reliability note: this depends on a working Nitter instance (NITTER_BASE). Public
instances are rate-limited/unstable; self-hosting Nitter needs guest tokens. This
is best-effort and against X's ToS — the official API is the reliable/safe path.
"""
import os
import re
import time
import html
import threading
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime

import httpx
from bs4 import BeautifulSoup
from fastapi import FastAPI, Header, HTTPException, Query

DC = "{http://purl.org/dc/elements/1.1/}"

NITTER_BASE = os.environ.get("NITTER_BASE", "https://nitter.net").rstrip("/")
WORKER_TOKEN = os.environ.get("WORKER_TOKEN", "")  # if set, callers must send it
MIN_INTERVAL_S = float(os.environ.get("MIN_INTERVAL_S", "2.0"))  # spacing per upstream
CACHE_TTL_S = int(os.environ.get("CACHE_TTL_S", "300"))
REQUEST_TIMEOUT_S = float(os.environ.get("REQUEST_TIMEOUT_S", "15"))
USER_AGENT = os.environ.get(
    "USER_AGENT",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
)

app = FastAPI(title="Outloud search worker")

_lock = threading.Lock()
_last_call = 0.0
_cache: dict[str, tuple[float, list[dict]]] = {}


def _throttle() -> None:
    """Space upstream calls so we don't burst the Nitter instance."""
    global _last_call
    with _lock:
        wait = _last_call + MIN_INTERVAL_S - time.time()
        if wait > 0:
            time.sleep(wait)
        _last_call = time.time()


def _count(item, klass: str) -> int:
    el = item.select_one(f".tweet-stats .{klass}")
    if not el:
        return 0
    parent = el.find_parent("span") or el.parent
    digits = re.sub(r"[^\d]", "", parent.get_text() if parent else "")
    return int(digits) if digits else 0


def _parse(html_text: str, now: datetime) -> list[dict]:
    soup = BeautifulSoup(html_text, "html.parser")
    posts: list[dict] = []
    for item in soup.select(".timeline-item"):
        # Skip retweets/pinned; we want original posts.
        if item.select_one(".retweet-header") or item.select_one(".pinned"):
            continue
        link = item.select_one("a.tweet-link")
        content = item.select_one(".tweet-content")
        if not link or not content:
            continue
        href = link.get("href", "")
        m = re.search(r"/status/(\d+)", href)
        if not m:
            continue
        tweet_id = m.group(1)
        handle = (item.select_one(".username").get_text(strip=True).lstrip("@")
                  if item.select_one(".username") else "")
        name = (item.select_one(".fullname").get_text(strip=True)
                if item.select_one(".fullname") else handle)
        text = html.unescape(content.get_text("\n", strip=True))
        if not text:
            continue
        date_el = item.select_one(".tweet-date a")
        created = now
        if date_el and date_el.get("title"):
            try:
                created = datetime.strptime(date_el["title"], "%b %d, %Y · %I:%M %p %Z").replace(tzinfo=timezone.utc)
            except ValueError:
                created = now
        posts.append({
            "id": tweet_id,
            "url": f"https://x.com/{handle or 'i'}/status/{tweet_id}",
            "authorHandle": handle,
            "authorName": name,
            "followers": 0,  # not on the search page; reachScore leans on engagement
            "text": text,
            "createdAt": created.astimezone(timezone.utc).isoformat(),
            "likes": _count(item, "icon-heart"),
            "replies": _count(item, "icon-comment"),
            "reposts": _count(item, "icon-retweet"),
            "quotes": _count(item, "icon-quote"),
        })
    return posts


@app.get("/health")
def health():
    return {"ok": True, "nitter": NITTER_BASE}


@app.get("/timeline")
def timeline(
    handle: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
    authorization: str | None = Header(default=None),
):
    """A user's recent ORIGINAL posts (for voice capture) via Nitter RSS — no X API,
    no account. Skips retweets (different author) and replies (start with @)."""
    if WORKER_TOKEN and authorization != f"Bearer {WORKER_TOKEN}":
        raise HTTPException(status_code=401, detail="bad token")

    h = handle.lstrip("@").strip()
    key = f"tl|{h.lower()}|{limit}"
    cached = _cache.get(key)
    if cached and time.time() - cached[0] < CACHE_TTL_S:
        return {"posts": cached[1]}

    _throttle()
    url = f"{NITTER_BASE}/{h}/rss"
    try:
        resp = httpx.get(url, timeout=REQUEST_TIMEOUT_S, headers={"user-agent": USER_AGENT}, follow_redirects=True)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"nitter unreachable: {exc}")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"nitter status {resp.status_code}")

    try:
        root = ET.fromstring(resp.content)
    except ET.ParseError as exc:
        raise HTTPException(status_code=502, detail=f"bad rss: {exc}")

    want = ("@" + h).lower()
    posts: list[dict] = []
    for item in root.iter("item"):
        creator_el = item.find(DC + "creator")
        creator = (creator_el.text or "").strip().lower() if creator_el is not None else ""
        if creator and creator != want:  # skip retweets of other accounts
            continue
        desc_el = item.find("description")
        title_el = item.find("title")
        raw = (desc_el.text if desc_el is not None and desc_el.text else (title_el.text if title_el is not None else "")) or ""
        text = BeautifulSoup(raw, "html.parser").get_text("\n").strip()
        if not text or text.startswith("@"):  # skip empties + replies
            continue
        posts.append({"text": text})
        if len(posts) >= limit:
            break

    _cache[key] = (time.time(), posts)
    return {"posts": posts}


@app.get("/search")
def search(
    q: str = Query(..., min_length=1),
    hours: int = Query(24, ge=1, le=168),
    limit: int = Query(50, ge=1, le=100),
    authorization: str | None = Header(default=None),
):
    if WORKER_TOKEN and authorization != f"Bearer {WORKER_TOKEN}":
        raise HTTPException(status_code=401, detail="bad token")

    key = f"{q.lower()}|{hours}|{limit}"
    cached = _cache.get(key)
    if cached and time.time() - cached[0] < CACHE_TTL_S:
        return {"posts": cached[1]}

    _throttle()
    url = f"{NITTER_BASE}/search"
    params = {"f": "tweets", "q": q, "e-nativeretweets": "on"}
    try:
        resp = httpx.get(url, params=params, timeout=REQUEST_TIMEOUT_S,
                         headers={"user-agent": USER_AGENT}, follow_redirects=True)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"nitter unreachable: {exc}")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"nitter status {resp.status_code}")

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=hours)
    posts = [p for p in _parse(resp.text, now)
             if datetime.fromisoformat(p["createdAt"]) >= cutoff][:limit]
    _cache[key] = (time.time(), posts)
    return {"posts": posts}
