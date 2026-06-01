// demo.jsx — interactive product surfaces for the Outloud landing
const { useState, useEffect, useRef, useCallback } = React;

/* ---------- scroll reveal hook ---------- */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const els = el.matches?.('.reveal') ? [el] : el.querySelectorAll('.reveal');
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    els.forEach((n, i) => { n.style.transitionDelay = (i % 6) * 60 + 'ms'; io.observe(n); });
    return () => io.disconnect();
  }, []);
  return ref;
}

/* ---------- count-up ---------- */
function useCountUp(target, run, dur = 1300) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) { setV(0); return; }
    let raf, start;
    const tick = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(target * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, dur]);
  return v;
}

/* ============================================================
   GENERATION DEMO — the centerpiece
   ============================================================ */
const DRAFTS = [
  {
    text: "spent the weekend making the app 40% faster.\n\nnobody asked for it. it just bugged me every time i opened the dashboard.\n\nthat's the whole reason. shipped dark mode too while i was in there.",
    match: 97,
  },
  {
    text: "load times were 40% slower than they had any right to be and i couldn't let it go.\n\nfixed it this weekend. threw in dark mode as a treat.\n\nsmall stuff. but this is the part of building i actually like.",
    match: 94,
  },
];
const STEPS = ["reading your last 40 posts", "matching cadence + word choice", "drafting in your voice"];

function Avatar({ initials }) {
  return <div className="tweet__av">{initials}</div>;
}

function Tweet({ text, name = "jack", handle = "@jack_builds", initials = "JK", typed }) {
  return (
    <div className="tweet">
      <Avatar initials={initials} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row center gap-8" style={{ flexWrap: "nowrap" }}>
          <span className="tweet__name">{name}</span>
          <span className="tweet__handle">{handle}</span>
          <span className="tweet__handle" style={{ color: "var(--faint)" }}>· now</span>
        </div>
        <div className="tweet__body">{typed !== undefined ? typed : text}</div>
      </div>
    </div>
  );
}

function GenerationDemo({ approvalMode = "picker" }) {
  const [phase, setPhase] = useState("idle"); // idle | gen | review | posted
  const [stepI, setStepI] = useState(0);
  const [typed, setTyped] = useState(["", ""]);
  const [picked, setPicked] = useState(0);
  const [editText, setEditText] = useState(DRAFTS[0].text);
  const [swipeIdx, setSwipeIdx] = useState(0);
  const [input, setInput] = useState("shipped dark mode + cut load time 40%. nobody asked but it bugged me every time i opened the app.");
  const timers = useRef([]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => () => clearTimers(), []);

  const reset = () => {
    clearTimers();
    setPhase("idle"); setStepI(0); setTyped(["", ""]); setPicked(0);
    setEditText(DRAFTS[0].text); setSwipeIdx(0);
  };

  const generate = () => {
    clearTimers();
    setPhase("gen"); setStepI(0); setTyped(["", ""]);
    STEPS.forEach((_, i) => timers.current.push(setTimeout(() => setStepI(i), i * 620)));
    // after steps, type out both drafts
    const startType = STEPS.length * 620 + 250;
    timers.current.push(setTimeout(() => {
      setPhase("review");
      DRAFTS.forEach((d, di) => {
        const chars = d.text.split("");
        chars.forEach((_, ci) => {
          timers.current.push(setTimeout(() => {
            setTyped((prev) => { const n = [...prev]; n[di] = d.text.slice(0, ci + 1); return n; });
          }, di * 120 + ci * 9));
        });
      });
    }, startType));
  };

  const post = () => { clearTimers(); setPhase("posted"); };

  const imp = useCountUp(4231, phase === "posted");
  const likes = useCountUp(318, phase === "posted");
  const follows = useCountUp(27, phase === "posted");

  const activeText = approvalMode === "inline" ? editText : DRAFTS[picked].text;

  return (
    <div className="win" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="win__bar">
        <span className="win__lights"><i></i><i></i><i></i></span>
        <span className="win__title">outloud / compose</span>
        <span style={{ marginLeft: "auto" }} className="row center gap-8">
          <span className="dot dot--live"></span>
          <span className="win__title">voice synced</span>
        </span>
      </div>

      <div style={{ padding: 22 }}>
        {/* INPUT */}
        <div className="mono" style={{ fontSize: 12, color: "var(--faint)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 10 }}>
          what did you ship?
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          spellCheck={false}
          style={{
            width: "100%", resize: "none", background: "var(--bg)", color: "var(--text)",
            border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "14px 16px",
            fontSize: 15.5, lineHeight: 1.5, outline: "none",
          }}
        />

        <div className="row center between" style={{ marginTop: 14, flexWrap: "wrap", gap: 12 }}>
          <div className="row center gap-8">
            <span className="tag"><span style={{ color: "var(--accent)" }}>changelog</span></span>
            <span className="tag mono">+ idea</span>
          </div>
          {phase === "idle" && (
            <button className="btn btn--primary" onClick={generate}>
              generate in my voice <span aria-hidden>→</span>
            </button>
          )}
          {(phase === "review" || phase === "posted") && (
            <button className="btn btn--ghost" onClick={reset}>start over</button>
          )}
        </div>

        {/* GENERATING */}
        {phase === "gen" && (
          <div style={{ marginTop: 22 }}>
            {STEPS.map((s, i) => (
              <div key={i} className="row center gap-12" style={{ padding: "9px 0", opacity: i <= stepI ? 1 : .3, transition: "opacity .3s" }}>
                <span className="mono" style={{ fontSize: 13, color: i < stepI ? "var(--accent)" : "var(--muted)", width: 16 }}>
                  {i < stepI ? "✓" : i === stepI ? "▍" : "·"}
                </span>
                <span className="mono" style={{ fontSize: 13.5, color: "var(--muted)" }}>{s}</span>
              </div>
            ))}
          </div>
        )}

        {/* REVIEW */}
        {phase === "review" && (
          <div style={{ marginTop: 22 }}>
            {approvalMode === "picker" && (
              <PickerReview typed={typed} picked={picked} setPicked={setPicked} onPost={post} />
            )}
            {approvalMode === "inline" && (
              <InlineReview typed={typed} editText={editText} setEditText={setEditText} onPost={post} />
            )}
            {approvalMode === "swipe" && (
              <SwipeReview typed={typed} swipeIdx={swipeIdx} setSwipeIdx={setSwipeIdx} onPost={post} />
            )}
          </div>
        )}

        {/* POSTED */}
        {phase === "posted" && (
          <div style={{ marginTop: 22 }}>
            <div className="row center gap-8" style={{ marginBottom: 14 }}>
              <span className="tag tag--accent"><span className="dot"></span> posted to X</span>
              <span className="win__title">12:04 · just now</span>
            </div>
            <div className="card" style={{ padding: 18 }}>
              <Tweet text={approvalMode === "swipe" ? DRAFTS[swipeIdx].text : activeText} />
            </div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 14 }}>
              <Stat label="impressions" value={imp.toLocaleString()} />
              <Stat label="likes" value={likes} />
              <Stat label="new followers" value={"+" + follows} accent />
            </div>
            <div className="mono" style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 14, textAlign: "center" }}>
              feedback loop closed → outloud learns what landed
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MatchBadge({ n }) {
  return (
    <span className="tag tag--accent mono" style={{ fontSize: 11.5 }}>
      {n}% your voice
    </span>
  );
}

/* ---- approval variant: PICKER (choose 1 of 2) ---- */
function PickerReview({ typed, picked, setPicked, onPost }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 12, color: "var(--faint)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 12 }}>
        2 drafts · pick one
      </div>
      <div className="grid" style={{ gap: 12 }}>
        {DRAFTS.map((d, i) => (
          <button key={i} onClick={() => setPicked(i)} style={{ textAlign: "left", padding: 0, background: "none" }}>
            <div className="card" style={{
              padding: 16,
              borderColor: picked === i ? "var(--accent)" : "var(--border)",
              boxShadow: picked === i ? "0 0 0 1px var(--accent)" : "none",
              transition: "border-color .2s, box-shadow .2s",
            }}>
              <div className="row between center" style={{ marginBottom: 10 }}>
                <MatchBadge n={d.match} />
                <span className="mono" style={{ fontSize: 12, color: picked === i ? "var(--accent)" : "var(--faint)" }}>
                  {picked === i ? "● selected" : "○ option " + (i + 1)}
                </span>
              </div>
              <Tweet typed={typed[i]} />
            </div>
          </button>
        ))}
      </div>
      <button className="btn btn--primary btn--block" style={{ marginTop: 16 }} onClick={onPost}>
        approve + post <span aria-hidden>↗</span>
      </button>
    </div>
  );
}

/* ---- approval variant: INLINE (edit then approve) ---- */
function InlineReview({ typed, editText, setEditText, onPost }) {
  const [started, setStarted] = useState(false);
  useEffect(() => { if (typed[0] === DRAFTS[0].text && !started) { setEditText(DRAFTS[0].text); setStarted(true); } }, [typed, started, setEditText]);
  return (
    <div>
      <div className="row between center" style={{ marginBottom: 12 }}>
        <span className="mono" style={{ fontSize: 12, color: "var(--faint)", letterSpacing: ".1em", textTransform: "uppercase" }}>
          your draft · tweak any word
        </span>
        <MatchBadge n={97} />
      </div>
      <div className="card" style={{ padding: 16 }}>
        <div className="tweet">
          <Avatar initials="JK" />
          <div style={{ flex: 1 }}>
            <div className="row center gap-8" style={{ marginBottom: 4 }}>
              <span className="tweet__name">jack</span>
              <span className="tweet__handle">@jack_builds</span>
            </div>
            <textarea
              value={started ? editText : typed[0]}
              onChange={(e) => setEditText(e.target.value)}
              rows={6}
              spellCheck={false}
              style={{
                width: "100%", resize: "none", background: "transparent", color: "var(--text)",
                border: "none", outline: "none", fontSize: 16, lineHeight: 1.5, fontFamily: "var(--font-body)",
              }}
            />
          </div>
        </div>
      </div>
      <div className="row center gap-12" style={{ marginTop: 16 }}>
        <button className="btn btn--ghost" style={{ flex: 1, justifyContent: "center" }}>regenerate</button>
        <button className="btn btn--primary" style={{ flex: 2, justifyContent: "center" }} onClick={onPost}>
          looks like me — post it <span aria-hidden>↗</span>
        </button>
      </div>
    </div>
  );
}

/* ---- approval variant: SWIPE (approve / skip a stack) ---- */
function SwipeReview({ typed, swipeIdx, setSwipeIdx, onPost }) {
  const d = DRAFTS[swipeIdx];
  const next = () => setSwipeIdx((swipeIdx + 1) % DRAFTS.length);
  return (
    <div>
      <div className="mono" style={{ fontSize: 12, color: "var(--faint)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 12, textAlign: "center" }}>
        draft {swipeIdx + 1} of {DRAFTS.length} · approve or skip
      </div>
      <div style={{ position: "relative" }}>
        <div className="card" style={{ padding: 18, position: "relative", zIndex: 2 }}>
          <div className="row between center" style={{ marginBottom: 12 }}>
            <MatchBadge n={d.match} />
          </div>
          <Tweet typed={typed[swipeIdx]} />
        </div>
        <div className="card" style={{ position: "absolute", inset: 0, transform: "translate(8px,10px) scale(.98)", zIndex: 1, opacity: .5 }}></div>
      </div>
      <div className="row center gap-12" style={{ marginTop: 18 }}>
        <button className="btn btn--ghost" style={{ flex: 1, justifyContent: "center" }} onClick={next}>
          ✕ skip
        </button>
        <button className="btn btn--primary" style={{ flex: 1, justifyContent: "center" }} onClick={onPost}>
          ✓ approve + post
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="card" style={{ padding: "14px 14px", textAlign: "left" }}>
      <div className="mono" style={{ fontSize: 11, color: "var(--faint)", letterSpacing: ".08em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, marginTop: 6, color: accent ? "var(--accent)" : "var(--text)", letterSpacing: "-.02em" }}>{value}</div>
    </div>
  );
}

/* ============================================================
   VOICE CAPTURE
   ============================================================ */
const FINGERPRINT = ["lowercase", "short lines", "no emoji", "self-deprecating", "numbers > adjectives", "ends mid-thought", "no hashtags", "dry humor"];
const SAMPLE_POSTS = [
  "lost a customer today because of a bug i shipped at 2am. lesson: stop shipping at 2am",
  "MRR is flat for the 3rd month. not panicking. ok slightly panicking",
  "rewrote the onboarding for the 4th time. this one's the one. (i have said this 4 times)",
];

function VoiceCapture() {
  const ref = useReveal();
  const [count, setCount] = useState(3);
  return (
    <div ref={ref} className="grid" style={{ gridTemplateColumns: "1.05fr 1fr", gap: 40, alignItems: "center" }}>
      <div className="reveal">
        <div className="kicker" style={{ marginBottom: 20 }}>01 — capture</div>
        <h2 className="h-sec" style={{ marginBottom: 18 }}>Paste 5 posts.<br />It learns how <span className="accent">you</span> sound.</h2>
        <p className="lede" style={{ marginBottom: 24 }}>
          No prompt engineering, no "act as a witty founder." Outloud reads your real posts and pulls out the cadence, the
          word choice, the things you'd never say. That fingerprint is the moat.
        </p>
        <div className="row gap-8" style={{ flexWrap: "wrap" }}>
          {FINGERPRINT.map((f) => <span key={f} className="tag mono">{f}</span>)}
        </div>
      </div>
      <div className="reveal win" style={{ padding: 0 }}>
        <div className="win__bar">
          <span className="win__lights"><i></i><i></i><i></i></span>
          <span className="win__title">onboarding / your voice</span>
        </div>
        <div style={{ padding: 18 }}>
          {SAMPLE_POSTS.map((p, i) => (
            <div key={i} className="card" style={{ padding: 14, marginBottom: 10, display: "flex", gap: 12 }}>
              <span className="mono" style={{ fontSize: 12, color: "var(--faint)" }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ fontSize: 14.5, lineHeight: 1.45, color: "var(--muted)" }}>{p}</span>
            </div>
          ))}
          <div style={{ border: "1px dashed var(--border-2)", borderRadius: "var(--radius-sm)", padding: "16px", textAlign: "center" }}>
            <span className="mono" style={{ fontSize: 13, color: "var(--faint)" }}>+ paste {Math.max(0, 5 - count)} more to lock your voice</span>
          </div>
          <div className="row center gap-12" style={{ marginTop: 14 }}>
            <div style={{ flex: 1, height: 6, background: "var(--bg)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: (count / 5 * 100) + "%", height: "100%", background: "var(--accent)", transition: "width .4s" }}></div>
            </div>
            <span className="mono" style={{ fontSize: 12.5, color: "var(--accent)" }}>{count}/5</span>
            <button className="btn btn--ghost" style={{ padding: "8px 12px", fontSize: 12.5 }} onClick={() => setCount(Math.min(5, count + 1))}>+ add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { useReveal, useCountUp, GenerationDemo, VoiceCapture, Tweet, Avatar, Stat, MatchBadge, DRAFTS, FINGERPRINT });
