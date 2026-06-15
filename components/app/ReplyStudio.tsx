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
type Target = { id: string; text: string; authorHandle: string; url?: string; angle?: string; angleType?: string }

const TOPICS_KEY = 'outloud.reply.topics'
// Mode B (discover by topic) is temporarily closed for users. The full discovery
// UI + logic below is kept intact — flip this to true to re-enable.
const DISCOVER_ENABLED = false
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

// One generated reply variant. Editable in place (some people like the idea but
// want to reword) — the same edit pattern as the New Post drafts. The tweetId is
// fixed, so editing the text never changes WHICH post the reply goes to.
function VariantCard({ tweetId, initialText }: { tweetId: string; initialText: string }) {
  const [text, setText] = useState(initialText)
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [posting, setPosting] = useState(false)
  const [posted, setPosted] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function postReply() {
    setPosting(true)
    setError('')
    try {
      const res = await fetch('/api/x/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, inReplyTo: tweetId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) {
        setPosted(data.url)
      } else {
        setError(data.error || "Couldn't post the reply. Try again.")
      }
    } catch {
      setError('Network error. Try again.')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border-muted bg-surface-container-low p-4">
      <div className="mb-2 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          aria-pressed={editing}
          className="flex items-center gap-1 font-code-label text-code-label text-on-surface-variant hover:text-on-surface"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{editing ? 'check' : 'edit'}</span>
          {editing ? 'Done' : 'Edit'}
        </button>
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
      </div>

      {editing ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          rows={3}
          className="w-full resize-none rounded-xl border border-border-muted bg-surface-container-lowest p-3 font-body-md leading-relaxed text-on-surface focus:border-electric-indigo focus:outline-none"
        />
      ) : (
        <p className="whitespace-pre-wrap font-body-md leading-relaxed text-on-surface">{text}</p>
      )}

      <div className="mt-3 flex items-center gap-3">
        {posted ? (
          <a
            href={posted}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-full bg-cyber-lime/15 px-4 py-2 font-code-label text-code-label text-cyber-lime transition-all hover:bg-cyber-lime/25"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">check_circle</span>
            Posted · view on X
          </a>
        ) : (
          <button
            type="button"
            onClick={postReply}
            disabled={posting || !text.trim()}
            className="flex items-center gap-1.5 rounded-full bg-electric-indigo px-4 py-2 font-code-label text-code-label text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
          >
            {posting ? (
              <><Spinner size={14} /> Posting…</>
            ) : (
              <><span aria-hidden="true" className="material-symbols-outlined text-[16px]">reply</span> Post reply</>
            )}
          </button>
        )}
        <span className="ml-auto font-code-label text-code-label text-on-surface-variant/60">{text.length} chars</span>
      </div>

      {error && (
        <p className="mt-2 font-body-sm text-body-sm text-error">
          {error}{' '}
          <a href={replyIntentUrl(tweetId, text)} target="_blank" rel="noreferrer" className="font-semibold text-electric-indigo hover:underline">
            Open on X to post →
          </a>
        </p>
      )}
    </div>
  )
}

// A chat to write + iteratively refine a reply to ONE post, mirroring the New Post
// composer. Auto-writes the first reply on open, then each message revises the
// current draft (shorter, sharper, different angle…). Every draft is postable, and
// the whole session is saved to History tied to the post being replied to.
type RTurn =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'assistant'; text: string }
  | { id: number; role: 'assistant'; draft: { fullText: string } }

function ReplyChat({
  target,
  voiceId,
  onDraftsLeft,
  onLimit,
  onNeedVoice,
}: {
  target: Target
  voiceId: string
  onDraftsLeft: (n: number) => void
  onLimit: () => void
  onNeedVoice: () => void
}) {
  const [turns, setTurns] = useState<RTurn[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [historyId, setHistoryId] = useState<string | undefined>(undefined)
  const counter = useState(() => ({ n: 0 }))[0]
  const nextId = () => ++counter.n

  async function run(history: RTurn[]) {
    setLoading(true)
    setError('')
    const payloadTurns = history.map((t) => ('draft' in t ? { role: 'assistant', draft: t.draft } : { role: t.role, text: t.text }))
    try {
      const res = await fetch('/api/reply/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: { tweetId: target.id, url: target.url, authorHandle: target.authorHandle, text: target.text, angle: target.angle, angleType: target.angleType },
          turns: payloadTurns,
          profileId: voiceId || undefined,
          historyId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409 && data.needsVoice) { onNeedVoice(); return }
      if (res.status === 403 && data.limitReached) { onLimit(); setError(data.error ?? "You've used all your drafts."); return }
      if (!res.ok) { setError(data.error ?? "Couldn't write a reply."); return }
      if (typeof data.draftsLeft === 'number') onDraftsLeft(data.draftsLeft)
      if (data.historyId) setHistoryId(data.historyId)
      if (data.ask) setTurns((t) => [...t, { id: nextId(), role: 'assistant', text: data.ask }])
      else if (data.draft) setTurns((t) => [...t, { id: nextId(), role: 'assistant', draft: data.draft }])
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  // Auto-write the first reply when the chat opens (one mount per target via key).
  useEffect(() => {
    run([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function send() {
    const text = input.trim()
    if (!text || loading) return
    const next: RTurn[] = [...turns, { id: nextId(), role: 'user', text }]
    setTurns(next)
    setInput('')
    run(next)
  }

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-border-muted pt-4">
      <h3 className="font-code-label text-code-label uppercase text-on-surface-variant">Reply in your voice</h3>
      {turns.map((t) =>
        'draft' in t ? (
          <VariantCard key={t.id} tweetId={target.id} initialText={t.draft.fullText} />
        ) : t.role === 'user' ? (
          <div key={t.id} className="self-end max-w-[85%] rounded-2xl rounded-br-md bg-electric-indigo/15 px-4 py-2.5">
            <p className="whitespace-pre-wrap font-body-md text-on-surface">{t.text}</p>
          </div>
        ) : (
          <div key={t.id} className="self-start max-w-[85%] rounded-2xl rounded-bl-md bg-surface-container-low px-4 py-2.5">
            <p className="whitespace-pre-wrap font-body-md text-on-surface">{t.text}</p>
          </div>
        ),
      )}
      {loading && (
        <div className="flex items-center gap-2 font-code-label text-code-label text-on-surface-variant">
          <Spinner size={16} className="text-electric-indigo" /> writing in your voice…
        </div>
      )}
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}

      {/* refine the reply with AI, conversationally */}
      <div className="flex items-end gap-2 rounded-2xl border border-border-muted bg-surface-container-low p-2 focus-within:border-electric-indigo/50">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          rows={1}
          aria-label="Refine reply"
          placeholder="ask to tighten, sharpen the take, change the angle…"
          className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-1.5 font-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none"
        />
        <button
          type="button"
          onClick={send}
          disabled={loading || !input.trim()}
          aria-label="Send"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-electric-indigo text-white transition-all hover:bg-primary-container active:scale-95 disabled:opacity-40"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">arrow_upward</span>
        </button>
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

  // The post a reply chat is open for (one chat at a time).
  const [target, setTarget] = useState<Target | null>(null)

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
  }
  // Open (or switch) the reply chat for a post. The ReplyChat is keyed by post id,
  // so it remounts and auto-writes a fresh first reply when the target changes.
  function openReply(t: Target) {
    setTarget(t)
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

  const tab = (m: 'link' | 'discover', label: string) =>
    `rounded-full px-4 py-1.5 font-code-label text-code-label transition-colors ${
      mode === m ? 'bg-electric-indigo text-white' : 'text-on-surface-variant hover:text-on-surface'
    }`

  const shown = results?.filter((r) => (showSkipped ? true : r.verdict !== 'skip')) ?? []
  const skippedCount = results?.filter((r) => r.verdict === 'skip').length ?? 0

  // The reply chat, rendered inline right under whichever post is the target (so
  // it never appears off-screen at the bottom of a long feed). Keyed by post id so
  // switching targets remounts it and writes a fresh first reply.
  const replyChat = target && (
    <ReplyChat
      key={target.id}
      target={target}
      voiceId={voiceId}
      onDraftsLeft={setLeft}
      onLimit={() => setLeft(0)}
      onNeedVoice={() => router.push('/app/onboarding')}
    />
  )

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
              {target?.id !== fetched.id && (
                <button
                  type="button"
                  onClick={() => openReply({ id: fetched.id, text: fetched.text, authorHandle: fetched.authorHandle, url: fetched.url })}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-electric-indigo px-5 py-2.5 font-bold text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  Write a reply
                </button>
              )}
              {target?.id === fetched.id && replyChat}
            </div>
          )}
        </div>
      )}

      {/* ── Mode B: discover by topic — temporarily closed (DISCOVER_ENABLED) ── */}
      {mode === 'discover' && !DISCOVER_ENABLED && (
        <div className="relative overflow-hidden rounded-2xl border border-border-muted">
          {/* blurred faux preview behind the lock */}
          <div aria-hidden className="pointer-events-none select-none blur-[7px] opacity-40">
            <div className="flex flex-col gap-4 p-5">
              <div className="h-12 rounded-xl bg-surface-container-high" />
              <div className="h-12 rounded-xl bg-surface-container-high" />
              <div className="h-28 rounded-2xl bg-surface-container-low" />
              <div className="h-28 rounded-2xl bg-surface-container-low" />
            </div>
          </div>
          {/* lock overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-electric-indigo/15 text-electric-indigo">
              <span className="material-symbols-outlined text-[32px]">lock</span>
            </span>
            <h3 className="font-headline-sm text-headline-sm">Discover by topic — coming soon</h3>
            <p className="max-w-sm font-body-sm text-body-sm text-on-surface-variant">
              We’re polishing topic discovery. For now, paste a post link and reply in your voice.
            </p>
            <button
              type="button"
              onClick={() => setMode('link')}
              className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-electric-indigo px-5 py-2 font-code-label text-code-label text-white transition-all hover:bg-primary-container active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">link</span> Paste a link instead
            </button>
          </div>
        </div>
      )}

      {/* ── Mode B: discover by topic (full UI/logic kept; shown when enabled) ── */}
      {mode === 'discover' && DISCOVER_ENABLED && (
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
            Big posts from the last 24h — high engagement and large accounts in your topic.
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
              {(r.reason || r.verdict === 'skip') && (
                <p className="mb-3 font-code-label text-code-label text-on-surface-variant/80">
                  {r.verdict === 'skip' ? `Skipped: ${r.reason || 'not worth the slot'}` : `“${r.reason}”`}
                </p>
              )}
              {r.verdict !== 'skip' && target?.id !== r.post.id && (
                <button
                  type="button"
                  onClick={() => openReply({ id: r.post.id, text: r.post.text, authorHandle: r.post.authorHandle, url: r.post.url, angle: r.suggestedAngle, angleType: r.angleType })}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-electric-indigo px-5 py-2 font-code-label text-code-label text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  Write reply
                </button>
              )}
              {target?.id === r.post.id && replyChat}
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

    </div>
  )
}
