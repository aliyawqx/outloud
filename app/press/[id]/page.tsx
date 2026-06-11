/* eslint-disable @next/next/no-img-element */
// Launch / Product Hunt gallery frames. Each renders at exactly 1270x760 so it can
// be screenshotted to PNG. One idea per frame, shared dark template (#0f0f13),
// big legible text. X-only claims, honest proof (22k views).

const INDIGO = '#b06bff'
const LIME = '#ADFF2F'
const BG = '#0f0f13'

function Brand({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/mascot.svg" alt="" className="h-9 w-9" />
      <span className="text-[26px] font-bold tracking-tight" style={{ color: light ? '#fff' : '#fff' }}>
        Outloud
      </span>
    </div>
  )
}

function Shell({ children, kicker }: { children: React.ReactNode; kicker?: string }) {
  return (
    <div
      className="relative flex h-[760px] w-[1270px] flex-col overflow-hidden"
      style={{ background: BG, fontFamily: 'var(--font-body, ui-sans-serif), system-ui, sans-serif' }}
    >
      {/* top glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[34rem] w-[44rem] -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: `radial-gradient(circle, ${INDIGO}55, transparent 70%)` }}
      />
      <div className="relative z-10 flex items-center justify-between px-14 pt-12">
        <Brand />
        {kicker ? (
          <span className="rounded-full border px-4 py-1.5 text-[14px] font-semibold tracking-widest" style={{ borderColor: `${LIME}55`, color: LIME }}>
            {kicker}
          </span>
        ) : (
          <span className="text-[15px] font-medium" style={{ color: '#6b7280' }}>
            getoutloud.app
          </span>
        )}
      </div>
      <div className="relative z-10 flex flex-1 flex-col px-14 pb-14">{children}</div>
    </div>
  )
}

/* ---------- shared little pieces ---------- */

function TweetCard({
  name,
  handle,
  avatar,
  avatarBg,
  body,
  tone,
  toneColor,
  border,
  views,
}: {
  name: string
  handle: string
  avatar: string
  avatarBg: string
  body: React.ReactNode
  tone?: string
  toneColor?: string
  border?: string
  views?: string
}) {
  return (
    <div className="flex w-full flex-col gap-4 rounded-3xl border p-7" style={{ borderColor: border || 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full text-[18px] font-bold text-white" style={{ background: avatarBg }}>
          {avatar}
        </span>
        <div className="flex flex-col">
          <span className="text-[18px] font-bold text-white">{name}</span>
          <span className="text-[15px]" style={{ color: '#6b7280' }}>
            {handle}
          </span>
        </div>
        {tone && (
          <span className="ml-auto rounded-full px-3 py-1 text-[13px] font-semibold" style={{ color: toneColor, background: `${toneColor}1f` }}>
            {tone}
          </span>
        )}
      </div>
      <p className="text-[22px] leading-relaxed" style={{ color: '#e6e7ea' }}>
        {body}
      </p>
      {views && (
        <div className="mt-1 flex items-center gap-2 text-[15px]" style={{ color: '#6b7280' }}>
          <span className="material-symbols-outlined text-[18px]">bar_chart</span>
          {views}
        </div>
      )}
    </div>
  )
}

/* ---------- frames ---------- */

function Frame1() {
  // Hero / social preview — strongest, minimal.
  return (
    <Shell>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <img src="/mascot.svg" alt="" className="mb-8 h-32 w-32 drop-shadow-[0_12px_40px_rgba(176,107,255,0.55)]" />
        <h1 className="text-[92px] font-extrabold leading-[1.02] tracking-tight text-white">
          sound like <span style={{ color: INDIGO }}>you.</span>
          <br />
          at <span style={{ color: LIME }}>scale.</span>
        </h1>
        <p className="mt-8 max-w-2xl text-[28px] leading-snug" style={{ color: '#9aa0aa' }}>
          an AI copilot that grows your X in your own voice.
        </p>
      </div>
    </Shell>
  )
}

function Frame2() {
  // Core action — Outloud writing a post in your voice.
  return (
    <Shell kicker="WRITE">
      <div className="flex flex-1 items-center gap-12">
        <div className="w-[42%] shrink-0">
          <h2 className="text-[54px] font-extrabold leading-[1.05] tracking-tight text-white">
            Turn what you ship into posts that{' '}
            <span style={{ color: INDIGO }}>sound like you</span>.
          </h2>
          <p className="mt-6 text-[22px] leading-snug" style={{ color: '#9aa0aa' }}>
            Drop a rough idea or a commit. Get a post in your cadence — not generic AI.
          </p>
        </div>
        <div className="flex flex-1 flex-col gap-4 rounded-3xl border p-7" style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
          <div className="flex items-center gap-2 text-[15px]" style={{ color: '#6b7280' }}>
            <span className="material-symbols-outlined text-[18px]" style={{ color: INDIGO }}>
              graphic_eq
            </span>
            outloud · in your voice
          </div>
          <div className="max-w-[80%] self-end rounded-2xl rounded-br-md px-5 py-3 text-[19px] text-white" style={{ background: `${INDIGO}26` }}>
            shipped dark mode + made exports 2x faster
          </div>
          <div className="rounded-2xl border p-5" style={{ borderColor: `${INDIGO}55`, background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-[22px] leading-relaxed text-white">
              dark mode shipped. exports run 2x faster now. spent the afternoon fighting a cache bug that turned out to be one missing await. one line. classic.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <span className="flex items-center gap-2 rounded-full px-5 py-2.5 text-[16px] font-semibold text-white" style={{ background: INDIGO }}>
                <span className="material-symbols-outlined text-[18px]">send</span> Post to X
              </span>
              <span className="text-[15px]" style={{ color: '#6b7280' }}>
                182 chars
              </span>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  )
}

function Frame3() {
  // The wedge — your voice vs AI slop.
  return (
    <Shell kicker="THE DIFFERENCE">
      <div className="flex flex-1 flex-col justify-center">
        <h2 className="mb-9 text-center text-[52px] font-extrabold tracking-tight text-white">
          Everyone else sounds like ChatGPT. <span style={{ color: LIME }}>You won&apos;t.</span>
        </h2>
        <div className="flex items-stretch gap-6">
          <div className="flex-1 opacity-70 grayscale">
            <span className="mb-3 block text-[15px] font-bold uppercase tracking-widest" style={{ color: '#6b7280' }}>
              Generic AI
            </span>
            <TweetCard
              name="Aliya"
              handle="@aliya_zhanabay"
              avatar="A"
              avatarBg="#3a3a42"
              border="rgba(255,255,255,0.08)"
              body="🚀 Excited to share that we just shipped dark mode! Huge thanks to our amazing team for making it happen. Stay tuned for more exciting updates! 🙌 #buildinpublic #saas"
            />
          </div>
          <div className="flex items-center">
            <span className="text-[22px] font-bold" style={{ color: '#6b7280' }}>
              vs
            </span>
          </div>
          <div className="flex-1">
            <span className="mb-3 block text-[15px] font-bold uppercase tracking-widest" style={{ color: LIME }}>
              You, on Outloud
            </span>
            <TweetCard
              name="Aliya"
              handle="@aliya_zhanabay"
              avatar="A"
              avatarBg={INDIGO}
              border={`${INDIGO}66`}
              tone="your voice"
              toneColor={INDIGO}
              body="dark mode shipped. the whole thing came down to one missing await in the cache layer. one line. shipped at 2am. classic."
            />
          </div>
        </div>
      </div>
    </Shell>
  )
}

function Frame4() {
  // Replies — a real angle, not generic praise.
  return (
    <Shell kicker="REPLIES">
      <div className="flex flex-1 flex-col justify-center">
        <h2 className="mb-8 text-[52px] font-extrabold leading-tight tracking-tight text-white">
          Replies with an actual take —<br />
          not <span style={{ color: '#6b7280' }}>&ldquo;Great post! 🙌&rdquo;</span>
        </h2>
        <div className="flex items-start gap-5">
          <div className="w-[46%]">
            <TweetCard
              name="Big Founder"
              handle="@bigfounder · 2h"
              avatar="B"
              avatarBg="#3a3a42"
              body="most build-in-public posts are noise. share the number that actually moved, or don't post."
              views="142K views"
            />
          </div>
          <span className="mt-16 material-symbols-outlined text-[40px]" style={{ color: INDIGO }}>
            subdirectory_arrow_right
          </span>
          <div className="flex-1">
            <TweetCard
              name="Aliya"
              handle="@aliya_zhanabay · now"
              avatar="A"
              avatarBg={INDIGO}
              border={`${INDIGO}66`}
              tone="drafted in your voice"
              toneColor={LIME}
              body="agreed. the one that moved for us: cut onboarding from 5 steps to 2 → activation went 38% → 61% in a week. everything else was vanity."
            />
          </div>
        </div>
      </div>
    </Shell>
  )
}

function Frame5() {
  // Voice extraction / onboarding — paste posts -> learns voice.
  const traits = ['lowercase', 'dry & technical', 'no emojis', 'short lines', 'specific numbers', 'no hashtags']
  return (
    <Shell kicker="ONBOARDING">
      <div className="flex flex-1 flex-col justify-center">
        <h2 className="mb-10 max-w-4xl text-[54px] font-extrabold leading-[1.05] tracking-tight text-white">
          Paste a few posts. Outloud learns <span style={{ color: INDIGO }}>exactly how you sound</span>.
        </h2>
        <div className="flex items-center gap-7">
          <div className="w-[44%] rounded-3xl border p-7" style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
            <div className="mb-4 flex items-center gap-2 text-[15px]" style={{ color: '#6b7280' }}>
              <span className="material-symbols-outlined text-[18px]">content_paste</span>
              paste your posts
            </div>
            <div className="flex flex-col gap-3">
              {['just shipped the thing. 4 days late but it works.', 'turns out the bug was in my head, not the code.', 'no thread. no hook. just: exports are 2x faster now.'].map((t) => (
                <p key={t} className="rounded-xl px-4 py-3 text-[18px] leading-snug" style={{ background: 'rgba(255,255,255,0.04)', color: '#d4d6da' }}>
                  {t}
                </p>
              ))}
            </div>
          </div>
          <span className="material-symbols-outlined text-[52px]" style={{ color: LIME }}>
            arrow_forward
          </span>
          <div className="flex-1 rounded-3xl border p-7" style={{ borderColor: `${INDIGO}55`, background: `${INDIGO}10` }}>
            <div className="mb-5 flex items-center gap-3">
              <img src="/mascot.svg" alt="" className="h-10 w-10" />
              <span className="text-[20px] font-bold text-white">your voice profile</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {traits.map((t) => (
                <span key={t} className="rounded-full border px-4 py-2 text-[17px] font-medium" style={{ borderColor: `${INDIGO}66`, color: '#fff', background: `${INDIGO}22` }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  )
}

function Frame6() {
  // Proof / story — 0->10k challenge + real 22k views receipt.
  return (
    <Shell kicker="BUILD IN PUBLIC">
      <div className="flex flex-1 items-center gap-12">
        <div className="w-[50%]">
          <span className="text-[18px] font-bold uppercase tracking-widest" style={{ color: LIME }}>
            user zero
          </span>
          <h2 className="mt-4 text-[58px] font-extrabold leading-[1.04] tracking-tight text-white">
            I&apos;m taking my own account <span style={{ color: INDIGO }}>0 → 10k</span> in 56 days.
          </h2>
          <p className="mt-6 text-[24px] leading-snug" style={{ color: '#9aa0aa' }}>
            Every post and reply written with Outloud, in my voice. Building it in public, in real time.
          </p>
        </div>
        <div className="flex flex-1 flex-col gap-5">
          <TweetCard
            name="Aliya"
            handle="@aliya_zhanabay · 3d"
            avatar="A"
            avatarBg={INDIGO}
            border={`${INDIGO}66`}
            tone="written with Outloud"
            toneColor={LIME}
            body="cut onboarding from 5 steps to 2 → activation 38% to 61% in a week. that's it. that's the post."
          />
          <div className="flex gap-4">
            {[
              { k: 'total views, build in public', v: '22K' },
              { k: 'written in your voice', v: '100%' },
              { k: 'generic AI slop', v: '0' },
            ].map((s) => (
              <div key={s.k} className="flex-1 rounded-2xl border p-5 text-center" style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
                <div className="text-[40px] font-extrabold" style={{ color: s.v === '0' ? LIME : '#fff' }}>
                  {s.v}
                </div>
                <div className="mt-1 text-[14px] leading-tight" style={{ color: '#6b7280' }}>
                  {s.k}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  )
}

const FRAMES: Record<string, () => React.JSX.Element> = {
  '1': Frame1,
  '2': Frame2,
  '3': Frame3,
  '4': Frame4,
  '5': Frame5,
  '6': Frame6,
}

export default async function PressFrame({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const Frame = FRAMES[id] || Frame1
  return (
    <div className="flex min-h-screen items-start justify-start" style={{ background: '#000' }}>
      {/* hide Next dev indicator so exported PNGs are clean */}
      <style>{`nextjs-portal{display:none!important}`}</style>
      <Frame />
    </div>
  )
}
