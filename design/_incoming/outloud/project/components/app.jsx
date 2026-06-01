// app.jsx — assembles the Outloud landing + wires Tweaks
const { useState: useStateA, useEffect: useEffectA } = React;

const ACCENTS = {
  signal:  "#f2643c",  // warm orange
  lime:    "#9fe02a",  // terminal
  electric:"#4f8dff",  // blue
  violet:  "#b06bff",  // violet
};
function inkFor(/* accent */) { return "#0a0a0b"; }

/* ---------- CLAIM (conversion) ---------- */
const SPOTS_TOTAL = 5, SPOTS_LEFT = 3;
const PERKS = [
  "Lock in the launch price ($50–100/mo)",
  "Shape the product before it ships",
  "First access when concierge spots open",
  "Your voice, captured — no AI slop",
];
function Claim() {
  const ref = useReveal();
  const [sent, setSent] = useStateA(false);
  const [handle, setHandle] = useStateA("");
  return (
    <section id="claim" className="section" ref={ref} style={{ background: "var(--bg-2)", borderTop: "1px solid var(--border)" }}>
      <div className="wrap">
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }}>
          <div className="reveal">
            <div className="kicker" style={{ marginBottom: 22 }}>early access · before launch</div>
            <h2 className="h-sec" style={{ marginBottom: 20, maxWidth: "14ch" }}>Get early access.</h2>
            <p className="lede" style={{ marginBottom: 28 }}>
              Join the founders who want to post consistently and grow an audience — in their own voice, without it
              eating their week.
            </p>
            <div className="grid" style={{ gap: 13 }}>
              {PERKS.map((p) => (
                <div key={p} className="row center gap-12">
                  <span className="mono accent" style={{ fontSize: 14, width: 16 }}>✓</span>
                  <span style={{ fontSize: 15.5, color: "var(--text)" }}>{p}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="reveal card" style={{ padding: 28, background: "var(--surface)" }}>
            <div className="row center between" style={{ marginBottom: 18 }}>
              <span className="tag tag--accent"><span className="dot dot--live"></span> {SPOTS_LEFT} of {SPOTS_TOTAL} left</span>
              <span className="mono" style={{ fontSize: 12.5, color: "var(--faint)" }}>$50–100 / mo at launch</span>
            </div>

            {/* early-bird strip */}
            <div style={{ border: "1px solid var(--accent-line)", background: "var(--accent-soft)", borderRadius: "var(--radius-sm)", padding: "14px 16px", marginBottom: 22 }}>
              <div className="row center between" style={{ flexWrap: "wrap", gap: 8 }}>
                <span className="mono" style={{ fontSize: 12, color: "var(--accent)", letterSpacing: ".08em", textTransform: "uppercase" }}>first 10 founders</span>
                <span className="row center gap-8">
                  <span className="mono" style={{ fontSize: 13, color: "var(--faint)", textDecoration: "line-through" }}>$50–100</span>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 24, color: "var(--accent)", letterSpacing: "-.02em" }}>$20</span>
                  <span className="mono" style={{ fontSize: 13, color: "var(--muted)" }}>/mo</span>
                </span>
              </div>
            </div>

            {!sent ? (
              <form onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
                <label className="mono" style={{ fontSize: 11.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: ".1em" }}>your X handle</label>
                <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@you" required
                  style={{ width: "100%", marginTop: 8, marginBottom: 16, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "13px 15px", color: "var(--text)", fontSize: 15, outline: "none" }} />
                <label className="mono" style={{ fontSize: 11.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: ".1em" }}>what are you shipping?</label>
                <textarea placeholder="one line on your product + MRR" rows={2}
                  style={{ width: "100%", marginTop: 8, marginBottom: 18, resize: "none", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "13px 15px", color: "var(--text)", fontSize: 15, outline: "none", lineHeight: 1.5 }} />
                <button type="submit" className="btn btn--primary btn--block">get early access <span aria-hidden>→</span></button>
                <div className="mono" style={{ fontSize: 12, color: "var(--faint)", marginTop: 14, textAlign: "center" }}>
                  founders only · $1k–10k MRR · i reply within 24h
                </div>
              </form>
            ) : (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--accent-soft)", border: "1px solid var(--accent-line)", display: "grid", placeItems: "center", margin: "0 auto 18px", color: "var(--accent)", fontSize: 22 }}>✓</div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 22, marginBottom: 10 }}>you're on the list, {handle || "founder"}.</div>
                <p style={{ color: "var(--muted)", fontSize: 15, maxWidth: "34ch", margin: "0 auto" }}>
                  I'll DM you on X within 24h with the 5 posts I need to learn your voice — and your $20/mo founder price locked in.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- FOOTER ---------- */
function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--border)", padding: "44px 0" }}>
      <div className="wrap row center between" style={{ flexWrap: "wrap", gap: 18 }}>
        <Logo />
        <span className="mono" style={{ fontSize: 13, color: "var(--faint)", maxWidth: "42ch" }}>
          built in public, out loud. the internet's about to get loud and fake — be the one real voice.
        </span>
        <span className="mono" style={{ fontSize: 12.5, color: "var(--faint)" }}>© 2026 outloud</span>
      </div>
    </footer>
  );
}

/* ---------- TWEAK DEFAULTS ---------- */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "violet",
  "style": "signal",
  "approvalMode": "picker"
}/*EDITMODE-END*/;

const STYLE_BG = {
  signal:   { "--bg": "#0a0a0b" },
  terminal: { "--bg": "#08090a" },
  editorial:{ "--bg": "#0c0b0d" },
  neon:     { "--bg": "#090a0e" },
};

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffectA(() => {
    const root = document.documentElement;
    const a = ACCENTS[t.accent] || ACCENTS.signal;
    root.style.setProperty("--accent", a);
    root.style.setProperty("--accent-2", a);
    document.body.setAttribute("data-style", t.style === "signal" ? "signal" : t.style);
  }, [t.accent, t.style]);

  return (
    <React.Fragment>
      <Nav />
      <Hero approvalMode={t.approvalMode} />
      <Problem />
      <How />
      <Differentiation />
      <Claim />
      <Footer />

      <TweaksPanel>
        <TweakSection label="Accent" />
        <TweakColor label="Signal color" value={ACCENTS[t.accent]}
          options={[ACCENTS.signal, ACCENTS.lime, ACCENTS.electric, ACCENTS.violet]}
          onChange={(hex) => {
            const key = Object.keys(ACCENTS).find((k) => ACCENTS[k] === hex) || "signal";
            setTweak("accent", key);
          }} />
        <TweakSection label="Visual style" />
        <TweakRadio label="Surface mood" value={t.style}
          options={["signal", "terminal", "editorial", "neon"]}
          onChange={(v) => setTweak("style", v)} />
        <TweakSection label="Approval flow (the demo)" />
        <TweakRadio label="UX variant" value={t.approvalMode}
          options={["picker", "inline", "swipe"]}
          onChange={(v) => setTweak("approvalMode", v)} />
        <div className="mono" style={{ fontSize: 11, color: "var(--faint)", padding: "2px 2px 0", lineHeight: 1.5 }}>
          picker = choose 1 of 2 · inline = edit in place · swipe = approve/skip a stack
        </div>
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
