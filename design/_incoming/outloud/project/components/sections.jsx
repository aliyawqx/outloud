// sections.jsx — page sections for the Outloud landing
const { useState: useStateS, useEffect: useEffectS } = React;

/* ---------- NAV ---------- */
function Nav() {
  const [scrolled, setScrolled] = useStateS(false);
  useEffectS(() => {
    const on = () => setScrolled(window.scrollY > 20);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      borderBottom: "1px solid " + (scrolled ? "var(--border)" : "transparent"),
      background: scrolled ? "color-mix(in oklab, var(--bg) 82%, transparent)" : "transparent",
      backdropFilter: scrolled ? "blur(12px)" : "none",
      transition: "background .3s, border-color .3s",
    }}>
      <div className="wrap row center between" style={{ height: 70 }}>
        <a href="#top" className="row center gap-12">
          <Logo />
        </a>
        <nav className="row center gap-24" style={{ fontSize: 14.5 }}>
          <a href="#how" className="dim mono" style={{ fontSize: 13.5 }}>how</a>
          <a href="#why" className="dim mono" style={{ fontSize: 13.5 }}>why us</a>
          <a href="#claim" className="btn btn--primary" style={{ padding: "10px 18px" }}>get early access</a>
        </nav>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <span className="row center gap-12">
      <span style={{ position: "relative", width: 26, height: 26, display: "grid", placeItems: "center" }}>
        <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid var(--accent)" }}></span>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }}></span>
      </span>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 20, letterSpacing: "-.02em" }}>outloud</span>
    </span>
  );
}

/* ---------- HERO ---------- */
function Hero({ approvalMode }) {
  const ref = useReveal();
  return (
    <section id="top" className="section" style={{ paddingTop: 70, paddingBottom: 100 }} ref={ref}>
      <div className="wrap">
        <div className="reveal row center gap-12" style={{ marginBottom: 28, flexWrap: "wrap" }}>
          <span className="tag tag--accent"><span className="dot dot--live"></span> 3 of 5 early-access spots left · first 10 founders $20/mo</span>
          <span className="tag mono">for indie SaaS founders, $1k–10k MRR</span>
        </div>
        <h1 className="reveal h-hero" style={{ maxWidth: "16ch", marginBottom: 26 }}>
          Build in public.<br />Stay consistent.<br />
          Get <span className="accent">known.</span>
        </h1>
        <p className="reveal lede" style={{ marginBottom: 34, fontSize: 21 }}>
          You hate marketing. You post in bursts, get 3 likes, go quiet for 6 months.
          Outloud turns what you <span style={{ color: "var(--text)" }}>ship</span> into X posts that sound like
          <span style={{ color: "var(--text)" }}> you</span> — approved in 30 seconds, posted, measured.
        </p>
        <div className="reveal row center gap-16" style={{ marginBottom: 16, flexWrap: "wrap" }}>
          <a href="#claim" className="btn btn--primary">get early access <span aria-hidden>→</span></a>
          <a href="#how" className="btn btn--ghost">see it write ↓</a>
        </div>
        <div className="reveal mono" style={{ fontSize: 13, color: "var(--faint)" }}>
          no scheduler. no faceless avatar. no generic slop. just your voice, on tap.
        </div>

        <div className="reveal" style={{ marginTop: 64 }}>
          <GenerationDemo approvalMode={approvalMode} />
        </div>
      </div>
    </section>
  );
}

/* ---------- PROBLEM (the Jack cycle) ---------- */
const CYCLE = [
  { n: "01", t: "you ship something good", d: "dark mode, a fix, a milestone. real progress." },
  { n: "02", t: "you force out a post", d: "stiff, over-thought, nothing like how you actually talk." },
  { n: "03", t: "3 likes", d: "the algorithm shrugs. so do your would-be customers." },
  { n: "04", t: "you go quiet for 6 months", d: "and the compounding never starts. sound familiar?" },
];
function Problem() {
  const ref = useReveal();
  return (
    <section className="section section--tight" ref={ref} style={{ background: "var(--bg-2)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
      <div className="wrap">
        <div className="reveal kicker kicker--muted" style={{ marginBottom: 22 }}>the cycle that kills indie founders</div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "start" }}>
          <h2 className="reveal h-sec" style={{ maxWidth: "14ch" }}>The build-in-public death spiral.</h2>
          <div className="reveal">
            <p className="lede" style={{ marginBottom: 20 }}>
              Jack built Friends Map to <span style={{ color: "var(--text)" }}>$6.4k MRR</span>, then watched it bleed out —
              not because the product broke, but because he stopped showing up. The posts felt fake, so he didn't post.
              No posts, no top-of-funnel, no MRR.
            </p>
            <span className="tag tag--accent mono">the problem was never the product. it was the silence.</span>
          </div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginTop: 56 }}>
          {CYCLE.map((c, i) => (
            <div key={c.n} className="reveal card" style={{ padding: 20, position: "relative" }}>
              <div className="mono accent" style={{ fontSize: 13, marginBottom: 14 }}>{c.n}</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, letterSpacing: "-.01em", marginBottom: 8 }}>{c.t}</div>
              <div style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.45 }}>{c.d}</div>
              {i < CYCLE.length - 1 && <span className="mono" style={{ position: "absolute", right: -11, top: "50%", color: "var(--faint)", zIndex: 2 }}>→</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- HOW (3 steps, anchors voice capture + analytics) ---------- */
function How() {
  const ref = useReveal();
  return (
    <section id="how" className="section" ref={ref}>
      <div className="wrap">
        <div className="reveal" style={{ marginBottom: 64, maxWidth: "20ch" }}>
          <div className="kicker" style={{ marginBottom: 20 }}>how it works</div>
          <h2 className="h-sec">Three moves. Thirty seconds a post.</h2>
        </div>
        <VoiceCapture />
        <hr className="hairline" style={{ margin: "72px 0" }} />
        <Analytics />
      </div>
    </section>
  );
}

/* ---------- ANALYTICS section ---------- */
function Analytics() {
  const ref = useReveal();
  const data = [22, 30, 18, 44, 38, 61, 52, 80, 73, 96];
  return (
    <div ref={ref} className="grid" style={{ gridTemplateColumns: "1fr 1.05fr", gap: 40, alignItems: "center" }}>
      <div className="reveal win" style={{ padding: 0, order: 1 }}>
        <div className="win__bar">
          <span className="win__lights"><i></i><i></i><i></i></span>
          <span className="win__title">outloud / analytics</span>
        </div>
        <div style={{ padding: 22 }}>
          <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 18 }}>
            <Stat label="28d impressions" value="184k" />
            <Stat label="profile clicks" value="2,910" />
            <Stat label="followers" value="+612" accent />
          </div>
          <div style={{ height: 120, display: "flex", alignItems: "flex-end", gap: 7, padding: "0 2px" }}>
            {data.map((d, i) => (
              <div key={i} style={{ flex: 1, height: d + "%", background: i === data.length - 1 ? "var(--accent)" : "var(--surface-3)", borderRadius: "3px 3px 0 0", transition: "height .4s", transitionDelay: i * 40 + "ms" }}></div>
            ))}
          </div>
          <div className="mono" style={{ fontSize: 12, color: "var(--faint)", marginTop: 12, textAlign: "right" }}>posts that sound like you ↗ compound</div>
        </div>
      </div>
      <div className="reveal" style={{ order: 2 }}>
        <div className="kicker" style={{ marginBottom: 20 }}>03 — close the loop</div>
        <h2 className="h-sec" style={{ marginBottom: 18 }}>See what landed.<br />Post more of <span className="accent">that</span>.</h2>
        <p className="lede" style={{ marginBottom: 24 }}>
          Impressions, likes and new followers per post — wired straight back in. No more guessing why one post hit and
          ten didn't. The feedback loop is the whole point: it's what turns 3-likes-then-silence into a habit that compounds.
        </p>
        <div className="row gap-8" style={{ flexWrap: "wrap" }}>
          <span className="tag mono">per-post impressions</span>
          <span className="tag mono">likes</span>
          <span className="tag mono">new followers</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- DIFFERENTIATION ---------- */
const COMPETE = [
  { name: "Buffer / Typefully", role: "schedulers", blurb: "queue what you already wrote. but you never write it.", v: "they schedule. outloud writes." },
  { name: "ChatGPT", role: "generic LLM", blurb: "no idea who you are. spits out 🚀 announcement slop.", v: "no voice. just vibes." },
  { name: "AI avatars / faceless", role: "slop farms", blurb: "the exact thing the algorithm is learning to bury.", v: "X won't lift it. ever." },
];
function GenericTweet() {
  return (
    <div className="card" style={{ padding: 16, borderColor: "var(--border)" }}>
      <div className="mono" style={{ fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>chatgpt, every time</div>
      <div className="tweet">
        <div className="tweet__av" style={{ color: "var(--faint)" }}>AI</div>
        <div style={{ flex: 1 }}>
          <div className="row center gap-8"><span className="tweet__name" style={{ color: "var(--muted)" }}>generic founder</span></div>
          <div className="tweet__body" style={{ color: "var(--muted)" }}>🚀 Excited to announce DARK MODE is here! Plus 40% faster load times ⚡ We're committed to delivering the best experience for our users. Let us know what you think 👇 #buildinpublic #SaaS</div>
        </div>
      </div>
    </div>
  );
}
function Differentiation() {
  const ref = useReveal();
  return (
    <section id="why" className="section" ref={ref} style={{ background: "var(--bg-2)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
      <div className="wrap">
        <div className="reveal" style={{ marginBottom: 56, maxWidth: "22ch" }}>
          <div className="kicker" style={{ marginBottom: 20 }}>why not just use X</div>
          <h2 className="h-sec">Everyone else writes <span className="accent">slop</span>. That's the moat.</h2>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1.1fr .9fr", gap: 40, alignItems: "center" }}>
          <div className="reveal grid" style={{ gap: 12 }}>
            {COMPETE.map((c) => (
              <div key={c.name} className="card" style={{ padding: 18, display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 16, alignItems: "center" }}>
                <span className="mono" style={{ fontSize: 16, color: "var(--faint)" }}>✕</span>
                <div>
                  <div className="row center gap-8" style={{ flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16.5 }}>{c.name}</span>
                    <span className="tag mono" style={{ fontSize: 11 }}>{c.role}</span>
                  </div>
                  <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 5 }}>{c.blurb}</div>
                </div>
                <span className="mono" style={{ fontSize: 12, color: "var(--faint)", textAlign: "right", maxWidth: 120 }}>{c.v}</span>
              </div>
            ))}
            <div className="card" style={{ padding: 18, display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 16, alignItems: "center", borderColor: "var(--accent)", boxShadow: "0 0 0 1px var(--accent), 0 20px 60px -30px var(--accent-line)" }}>
              <span className="mono accent" style={{ fontSize: 16 }}>✓</span>
              <div>
                <div className="row center gap-8" style={{ flexWrap: "wrap" }}>
                  <Logo />
                </div>
                <div style={{ fontSize: 14, color: "var(--text)", marginTop: 7 }}>the only one that actually sounds like the founder.</div>
              </div>
              <span className="mono accent" style={{ fontSize: 12, textAlign: "right", maxWidth: 120 }}>your voice = the ditch they can't cross</span>
            </div>
          </div>
          <div className="reveal"><GenericTweet /></div>
        </div>
      </div>
    </section>
  );
}

/* ---------- THESIS 2029 ---------- */
function Thesis() {
  const ref = useReveal();
  return (
    <section id="thesis" className="section" ref={ref}>
      <div className="wrap" style={{ maxWidth: 900 }}>
        <div className="reveal kicker" style={{ marginBottom: 28, justifyContent: "center", display: "flex" }}>the 2029 bet</div>
        <h2 className="reveal" style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "clamp(28px,4vw,46px)", lineHeight: 1.18, letterSpacing: "-.025em", textAlign: "center", textWrap: "balance" }}>
          The internet is about to drown in AI slop. When it does,
          <span className="accent"> a real human voice becomes the premium</span> — and the algorithms will only lift
          what's backed by an actual person.
        </h2>
        <p className="reveal lede" style={{ margin: "32px auto 0", textAlign: "center", maxWidth: "60ch" }}>
          Outloud is the one tool that ties a living founder to AI-speed production. Not replacing you — amplifying the
          one thing AI can't fake: that it's <span style={{ color: "var(--text)" }}>actually you</span>.
        </p>
        <div className="reveal row center" style={{ justifyContent: "center", gap: 12, marginTop: 36, flexWrap: "wrap" }}>
          <span className="tag mono">authenticity = the new premium</span>
          <span className="tag mono">human-backed &gt; faceless</span>
          <span className="tag mono">voice is unforgeable</span>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { Nav, Logo, Hero, Problem, How, Analytics, Differentiation, Thesis });
