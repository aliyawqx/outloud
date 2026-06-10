'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Spinner } from '@/components/Spinner'
import { replyIntentUrl } from '@/lib/x/replyIntent'

type VoiceOption = { id: string; name: string; isActive: boolean }
type FetchedPost = { id: string; url: string; authorHandle: string; authorName: string; text: string; postedAt: string }
type Candidate = {
  id: string; url: string; authorHandle: string; authorName: string; followers: number
  text: string; ageHours: number; likes: number; replies: number; reposts: number; quotes: number
}
type Verdict = 'reply' | 'maybe' | 'skip'
type JudgedResult = { post: Candidate; verdict: Verdict; reason: string; suggestedAngle: string; angleType: string; confidence: number }
// The post we're generating a reply for, plus any angle the judge suggested.
type Target = { id: string; text: string; authorHandle: string; angle?: string; angleType?: string }

const TOPICS_KEY = 'outloud.reply.topics'
const field =
  'w-full rounded-xl border border-border-muted bg-surface-container-lowest px-4 py-3 font-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:border-electric-indigo focus:outline-none'

function relAge(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m ago`
  if (hours < 24) return `${Math.round(hours)}h ago`
  return `${Math.round(hours / 24)}d ago`
}

const verdictBadge: Record<Verdict, string> = {
  reply: 'border-cyber-lime/40 bg-cyber-lime/10 text-cyber-lime',
  maybe: 'border-border-muted bg-surface-container-high text-on-surface-variant',
  skip: 'border-error/30 bg-error/10 text-error',
}

// One generated reply variant: editable, with a web-intent "Reply on X" button.
function VariantCard({ tweetId, initialText }: { tweetId: string; initialText: string }) {
  const [text, setText] = useState(initialText)
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded-2xl border border-border-muted bg-surface-container-low p-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        className="w-full resize-none rounded-lg bg-transparent font-body-md leading-relaxed text-on-surface focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-3">
        <a
          href={replyIntentUrl(tweetId, text)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-full bg-electric-indigo px-4 py-2 font-code-label text-code-label text-white transition-all hover:bg-primary-container active:scale-95"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">reply</span>
          Reply on X
        </a>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="flex items-center gap-1 font-code-label text-code-label text-on-surface-variant hover:text-on-surface"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">content_copy</span>
          {copied ? 'Copied' : 'Copy'}
        </button>
        <span className="ml-auto font-code-label text-code-label text-on-surface-variant/60">{text.length} chars</span>
      </div>
    </div>
  )
}

export function ReplyStudio({
  voices,
  xConnected,
  draftsLeft,
}: {
  voices: VoiceOption[]
  xConnected: boolean
  draftsLeft: number | null
}) {
  const router = useRouter()
  const active = voices.find((v) => v.isActive) ?? voices[0]
  const [voiceId, setVoiceId] = useState(active?.id ?? '')
  const [mode, setMode] = useState<'link' | 'discover'>('link')
  const [left, setLeft] = useState<number | null>(draftsLeft)

  // Mode A
  const [url, setUrl] = useState('')
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [fetched, setFetched] = useState<FetchedPost | null>(null)

  // Mode B
  const [interests, setInterests] = useState('')
  const [topic, setTopic] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [results, setResults] = useState<JudgedResult[] | null>(null)
  const [showSkipped, setShowSkipped] = useState(false)

  // Generation (shared)
  const [target, setTarget] = useState<Target | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [variants, setVariants] = useState<string[]>([])

  // Persist the last-used topics so they don't retype every time.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(TOPICS_KEY) || '{}')
      if (saved.interests) setInterests(saved.interests)
      if (saved.topic) setTopic(saved.topic)
    } catch {}
  }, [])
  function saveTopics(next: { interests: string; topic: string }) {
    try {
      localStorage.setItem(TOPICS_KEY, JSON.stringify(next))
    } catch {}
  }

  function resetGeneration() {
    setTarget(null)
    setVariants([])
    setGenError('')
  }

  async function onFetch() {
    const u = url.trim()
    if (!u || fetching) return
    setFetchError('')
    setFetched(null)
    resetGeneration()
    setFetching(true)
    try {
      const res = await fetch('/api/reply/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFetchError(data.error ?? "Couldn't read that post.")
        return
      }
      setFetched(data.post)
    } catch {
      setFetchError('Network error. Try again.')
    } finally {
      setFetching(false)
    }
  }

  async function onSearch() {
    const t = topic.trim()
    if (!t || searching) return
    setSearchError('')
    setResults(null)
    resetGeneration()
    saveTopics({ interests: interests.trim(), topic: t })
    setSearching(true)
    try {
      const res = await fetch('/api/reply/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: t, interests: interests.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409 && data.needsVoice) {
        router.push('/app/onboarding')
        return
      }
      if (!res.ok) {
        setSearchError(data.error ?? "Couldn't search right now.")
        return
      }
      setResults(data.results ?? [])
    } catch {
      setSearchError('Network error. Try again.')
    } finally {
      setSearching(false)
    }
  }

  async function generate(t: Target) {
    if (generating) return
    setTarget(t)
    setVariants([])
    setGenError('')
    setGenerating(true)
    try {
      const res = await fetch('/api/reply/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post: { id: t.id, text: t.text, authorHandle: t.authorHandle },
          angle: t.angle,
          angleType: t.angleType,
          profileId: voiceId || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409 && data.needsVoice) {
        router.push('/app/onboarding')
        return
      }
      if (res.status === 403 && data.limitReached) {
        setLeft(0)
        setGenError(data.error ?? "You've used all your drafts.")
        return
      }
      if (!res.ok) {
        setGenError(data.error ?? "Couldn't write a reply.")
        return
      }
      if (typeof data.draftsLeft === 'number') setLeft(data.draftsLeft)
      if (data.ask) {
        setGenError(data.ask)
        return
      }
      setVariants(data.variants ?? [])
    } catch {
      setGenError('Network error. Try again.')
    } finally {
      setGenerating(false)
    }
  }

  const tab = (m: 'link' | 'discover', label: string) =>
    `rounded-full px-4 py-1.5 font-code-label text-code-label transition-colors ${
      mode === m ? 'bg-electric-indigo text-white' : 'text-on-surface-variant hover:text-on-surface'
    }`

  const shown = results?.filter((r) => (showSkipped ? true : r.verdict !== 'skip')) ?? []
  const skippedCount = results?.filter((r) => r.verdict === 'skip').length ?? 0

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 font-headline-xl text-headline-xl">New reply</h1>
      <p className="mb-6 font-body-md text-body-md text-on-surface-variant">
        Reply to someone else’s X post in your own voice. Paste a link, or find recent high-reach posts in your topic.
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-full border border-border-muted bg-surface-container-low p-1">
          <button type="button" className={tab('link', 'Paste link')} onClick={() => setMode('link')}>Paste a link</button>
          <button type="button" className={tab('discover', 'Discover')} onClick={() => setMode('discover')}>Discover by topic</button>
        </div>
        {voices.length > 0 && (
          <label className="ml-auto flex items-center gap-2 font-code-label text-code-label text-on-surface-variant">
            Voice
            <select
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              aria-label="Voice"
              className="rounded-lg border border-border-muted bg-surface-container-lowest px-3 py-1.5 font-body-sm text-body-sm text-on-surface focus:border-electric-indigo focus:outline-none"
            >
              {voices.map((v) => (
                <option key={v.id} value={v.id}>{v.name}{v.isActive ? ' (active)' : ''}</option>
              ))}
            </select>
          </label>
        )}
        {left !== null && (
          <span className={`font-code-label text-code-label ${left > 0 ? 'text-on-surface-variant/70' : 'text-error'}`}>
            {left > 0 ? `${left} of 5 drafts left` : 'No drafts left'}
          </span>
        )}
      </div>

      {/* ── Mode A: paste a link ───────────────────────────────────── */}
      {mode === 'link' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onFetch()}
              placeholder="https://x.com/user/status/123…"
              className={field}
            />
            <button
              type="button"
              onClick={onFetch}
              disabled={fetching || !url.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-electric-indigo px-5 py-3 font-bold text-white transition-all active:scale-95 disabled:opacity-50"
            >
              {fetching ? <><Spinner size={16} /> Fetching…</> : 'Fetch post'}
            </button>
          </div>
          {fetchError && <p className="font-body-sm text-body-sm text-error">{fetchError}</p>}

          {fetched && (
            <div className="rounded-2xl border border-border-muted bg-surface-container-low p-4">
              <div className="mb-1 font-body-sm text-body-sm">
                <span className="font-bold text-on-surface">{fetched.authorName}</span>{' '}
                <span className="text-on-surface-variant">@{fetched.authorHandle} · {fetched.postedAt}</span>
              </div>
              <p className="whitespace-pre-wrap font-body-md text-on-surface">{fetched.text}</p>
              <button
                type="button"
                onClick={() => generate({ id: fetched.id, text: fetched.text, authorHandle: fetched.authorHandle })}
                disabled={generating}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-electric-indigo px-5 py-2.5 font-bold text-white transition-all active:scale-95 disabled:opacity-50"
              >
                {generating ? <><Spinner size={16} /> Writing…</> : 'Generate replies'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Mode B: discover by topic ──────────────────────────────── */}
      {mode === 'discover' && (
        <div className="flex flex-col gap-4">
          {!xConnected && (
            <div className="rounded-2xl border border-border-muted bg-surface-container-low p-4 font-body-sm text-body-sm text-on-surface-variant">
              Connect your X account in <a href="/app/profile" className="text-electric-indigo hover:underline">Profile</a> to discover posts.
            </div>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="font-code-label text-code-label uppercase text-on-surface-variant">What are you interested in?</span>
            <input value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="indie hacking, AI tools, build in public" className={field} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-code-label text-code-label uppercase text-on-surface-variant">Topic to comment on</span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                placeholder="e.g. AI agents"
                className={field}
              />
              <button
                type="button"
                onClick={onSearch}
                disabled={searching || !topic.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-electric-indigo px-5 py-3 font-bold text-white transition-all active:scale-95 disabled:opacity-50"
              >
                {searching ? <><Spinner size={16} /> Finding…</> : 'Find posts'}
              </button>
            </div>
          </label>
          <p className="font-code-label text-code-label text-on-surface-variant/60">
            Recent posts from the last 12h, ranked by reach (followers + engagement).
          </p>
          {searchError && <p className="font-body-sm text-body-sm text-error">{searchError}</p>}

          {results && shown.length === 0 && !searchError && (
            <p className="font-body-sm text-body-sm text-on-surface-variant">No worthwhile posts right now. Try another topic.</p>
          )}

          {shown.map((r) => (
            <div key={r.post.id} className="rounded-2xl border border-border-muted bg-surface-container-low p-4">
              <div className="mb-1 flex items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 font-code-label text-[11px] uppercase ${verdictBadge[r.verdict]}`}>{r.verdict}</span>
                <span className="font-body-sm text-body-sm font-bold text-on-surface">{r.post.authorName}</span>
                <span className="font-code-label text-code-label text-on-surface-variant">@{r.post.authorHandle} · {relAge(r.post.ageHours)}</span>
              </div>
              <p className="mb-2 whitespace-pre-wrap font-body-md text-on-surface">{r.post.text}</p>
              <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-code-label text-code-label text-on-surface-variant/70">
                <span>{r.post.followers.toLocaleString()} followers</span>
                <span>♥ {r.post.likes}</span>
                <span>↺ {r.post.reposts}</span>
                <span>💬 {r.post.replies}</span>
              </div>
              {r.reason && <p className="mb-3 font-code-label text-code-label text-on-surface-variant/80">“{r.reason}”</p>}
              {r.verdict !== 'skip' && (
                <button
                  type="button"
                  onClick={() => generate({ id: r.post.id, text: r.post.text, authorHandle: r.post.authorHandle, angle: r.suggestedAngle, angleType: r.angleType })}
                  disabled={generating}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-electric-indigo px-5 py-2 font-code-label text-code-label text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  {generating && target?.id === r.post.id ? <><Spinner size={14} /> Writing…</> : 'Write reply'}
                </button>
              )}
            </div>
          ))}

          {skippedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowSkipped((s) => !s)}
              className="self-start font-code-label text-code-label text-on-surface-variant underline-offset-2 hover:underline"
            >
              {showSkipped ? 'Hide skipped' : `Show ${skippedCount} skipped`}
            </button>
          )}
        </div>
      )}

      {/* ── Generated variants (shared) ────────────────────────────── */}
      {(genError || variants.length > 0 || (generating && target)) && (
        <div className="mt-8 flex flex-col gap-3">
          <h2 className="font-code-label text-code-label uppercase text-on-surface-variant">Replies in your voice</h2>
          {generating && <div className="flex items-center gap-2 font-code-label text-code-label text-on-surface-variant"><Spinner size={16} className="text-electric-indigo" /> writing in your voice…</div>}
          {genError && <p className="font-body-sm text-body-sm text-error">{genError}</p>}
          {target && variants.map((v, i) => <VariantCard key={i} tweetId={target.id} initialText={v} />)}
        </div>
      )}
    </div>
  )
}
