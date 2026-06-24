---
version: alpha
name: Claude-design-analysis
description: A warm-canvas editorial interface. The system anchors on a tinted cream canvas with serif display headlines, warm coral CTAs, and dark navy product surfaces (code editor mockups, model showcase cards). Brand voltage comes from the cream/coral pairing — deliberately warm and humanist where most AI brands use cool blue + slate. Type voice runs a slab-serif display ("Copernicus" / Tiempos Headline) for h1/h2 and a humanist sans for body.

colors:
  primary: "#cc785c"
  primary-active: "#a9583e"
  primary-disabled: "#e6dfd8"
  ink: "#141413"
  body: "#3d3d3a"
  body-strong: "#252523"
  muted: "#6c6a64"
  muted-soft: "#8e8b82"
  hairline: "#e6dfd8"
  hairline-soft: "#ebe6df"
  canvas: "#faf9f5"
  surface-soft: "#f5f0e8"
  surface-card: "#efe9de"
  surface-cream-strong: "#e8e0d2"
  surface-dark: "#181715"
  surface-dark-elevated: "#252320"
  surface-dark-soft: "#1f1e1b"
  on-primary: "#ffffff"
  on-dark: "#faf9f5"
  on-dark-soft: "#a09d96"
  accent-teal: "#5db8a6"
  accent-amber: "#e8a55a"
  success: "#5db872"
  warning: "#d4a017"
  error: "#c64545"

typography:
  display-xl: { fontFamily: "Copernicus, Tiempos Headline, serif", fontSize: 64px, fontWeight: 400, lineHeight: 1.05, letterSpacing: -1.5px }
  display-lg: { fontFamily: "Copernicus, Tiempos Headline, serif", fontSize: 48px, fontWeight: 400, lineHeight: 1.1, letterSpacing: -1px }
  display-md: { fontFamily: "Copernicus, Tiempos Headline, serif", fontSize: 36px, fontWeight: 400, lineHeight: 1.15, letterSpacing: -0.5px }
  display-sm: { fontFamily: "Copernicus, Tiempos Headline, serif", fontSize: 28px, fontWeight: 400, lineHeight: 1.2, letterSpacing: -0.3px }
  title-lg: { fontFamily: "StyreneB, Inter, sans-serif", fontSize: 22px, fontWeight: 500, lineHeight: 1.3, letterSpacing: 0 }
  title-md: { fontFamily: "StyreneB, Inter, sans-serif", fontSize: 18px, fontWeight: 500, lineHeight: 1.4, letterSpacing: 0 }
  title-sm: { fontFamily: "StyreneB, Inter, sans-serif", fontSize: 16px, fontWeight: 500, lineHeight: 1.4, letterSpacing: 0 }
  body-md: { fontFamily: "StyreneB, Inter, sans-serif", fontSize: 16px, fontWeight: 400, lineHeight: 1.55, letterSpacing: 0 }
  body-sm: { fontFamily: "StyreneB, Inter, sans-serif", fontSize: 14px, fontWeight: 400, lineHeight: 1.55, letterSpacing: 0 }
  caption: { fontFamily: "StyreneB, Inter, sans-serif", fontSize: 13px, fontWeight: 500, lineHeight: 1.4, letterSpacing: 0 }
  caption-uppercase: { fontFamily: "StyreneB, Inter, sans-serif", fontSize: 12px, fontWeight: 500, lineHeight: 1.4, letterSpacing: 1.5px }
  code: { fontFamily: "JetBrains Mono, ui-monospace, monospace", fontSize: 14px, fontWeight: 400, lineHeight: 1.6, letterSpacing: 0 }
  button: { fontFamily: "StyreneB, Inter, sans-serif", fontSize: 14px, fontWeight: 500, lineHeight: 1, letterSpacing: 0 }
  nav-link: { fontFamily: "StyreneB, Inter, sans-serif", fontSize: 14px, fontWeight: 500, lineHeight: 1.4, letterSpacing: 0 }

rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  pill: 9999px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 96px
---

## Overview

The base atmosphere is a **tinted cream canvas** (#faf9f5) — distinctly warm, deliberately not the cool gray-white that every other AI brand uses. Headlines run a **slab-serif display** ("Copernicus" / Tiempos Headline) at weight 400 with negative letter-spacing, paired with **StyreneB / Inter** body sans. The combination feels like a literary publication, not a SaaS marketing page.

Brand voltage comes from the **cream + coral pairing** — coral (#cc785c) is the signature accent, used on every primary CTA, on the brand wordmark, and on full-bleed callout cards. The coral is warm, slightly muted, never cyan/blue.

Three surface modes alternate page-by-page:
1. **Cream canvas** (#faf9f5) — default body floor
2. **Light cream cards** (#efe9de) — feature card backgrounds
3. **Dark navy product surfaces** (#181715) — code editor mockups, model showcase cards, pre-footer CTAs, footer

The cream-to-dark contrast is the page's pacing rhythm.

## Colors

### Brand & Accent
- **Coral / Primary** (#cc785c): signature warm coral. Every primary CTA, full-bleed coral callout cards, brand wordmark accent.
- **Coral Active** (#a9583e): press / hover-darker variant.
- **Coral Disabled** (#e6dfd8): desaturated cream-tinted disabled state.
- **Accent Teal** (#5db8a6): sparingly on secondary product surfaces (status dots).
- **Accent Amber** (#e8a55a): small companion warm-tone on category badges, inline highlights.

### Surface
- **Canvas** (#faf9f5): default page floor. Warm cream, not pure white.
- **Surface Soft** (#f5f0e8): section dividers, soft band backgrounds.
- **Surface Card** (#efe9de): feature cards, content cards. One step darker than canvas.
- **Surface Cream Strong** (#e8e0d2): selected tabs, emphasized bands.
- **Surface Dark** (#181715): code mockups, model cards, footer. Dominant dark surface.
- **Surface Dark Elevated** (#252320): elevated cards inside dark bands.
- **Surface Dark Soft** (#1f1e1b): code block backgrounds inside larger dark cards.
- **Hairline** (#e6dfd8): 1px border tone on cream surfaces.
- **Hairline Soft** (#ebe6df): barely-visible divider within a band.

### Text
- **Ink** (#141413): headlines and primary text. Warm dark.
- **Body Strong** (#252523): emphasized paragraphs, lead text.
- **Body** (#3d3d3a): default running-text.
- **Muted** (#6c6a64): sub-headings, breadcrumbs.
- **Muted Soft** (#8e8b82): captions, fine-print.
- **On Primary** (#ffffff): text on coral buttons.
- **On Dark** (#faf9f5): cream-tinted white on dark surfaces.
- **On Dark Soft** (#a09d96): footer body, secondary labels on dark.

### Semantic
- **Success** (#5db872) · **Warning** (#d4a017) · **Error** (#c64545)

## Typography

Run **Copernicus** (or **Tiempos Headline**) as the slab-serif display face for headlines, and **StyreneB** (or **Inter**) as the humanist sans for body/nav/UI. **JetBrains Mono** for code. Display sizes use weight 400 (never bold) with negative letter-spacing (-0.3 to -1.5px) — essential to the brand voice. Body stays weight 400 (paragraphs) / 500 (labels).

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| display-xl | 64px | 400 | 1.05 | -1.5px | Homepage h1 — Copernicus serif |
| display-lg | 48px | 400 | 1.1 | -1px | Section heads |
| display-md | 36px | 400 | 1.15 | -0.5px | Sub-section heads, model names |
| display-sm | 28px | 400 | 1.2 | -0.3px | Pricing tier names, callout headlines |
| title-lg | 22px | 500 | 1.3 | 0 | Pricing plan labels — StyreneB |
| title-md | 18px | 500 | 1.4 | 0 | Feature card titles |
| title-sm | 16px | 500 | 1.4 | 0 | Tile titles, list labels |
| body-md | 16px | 400 | 1.55 | 0 | Default running-text |
| body-sm | 14px | 400 | 1.55 | 0 | Footer body, fine-print |
| caption | 13px | 500 | 1.4 | 0 | Badge labels, captions |
| caption-uppercase | 12px | 500 | 1.4 | 1.5px | Category tags, "NEW" badges |
| code | 14px | 400 | 1.6 | 0 | Code blocks — JetBrains Mono |
| button | 14px | 500 | 1.0 | 0 | Button labels |
| nav-link | 14px | 500 | 1.4 | 0 | Top-nav items |

### Font Substitutes
Copernicus / StyreneB are licensed and not public web fonts. Closest open-source: **Cormorant Garamond** (weight 500, -0.02em) or **EB Garamond** for the serif display; **Inter** for the sans body.

## Layout
- Base unit 4px. Tokens: xxs 4 · xs 8 · sm 12 · md 16 · lg 24 · xl 32 · xxl 48 · section 96.
- Section padding 96px. Card padding 32px (feature/pricing) or 24px (code/tiles). Coral callout 48px; dark CTA band 64px.
- Max content width ~1200px centered. Hero 6/6 split. Feature grids 3-up desktop / 2-up tablet / 1-up mobile.

## Elevation
Color-block first, shadow rare. Most depth comes from cream-vs-dark surface contrast. Hover-elevated states use a faint `0 1px 3px rgba(20,20,19,0.08)` rarely.

## Shapes
Radius scale: 4 (badge accents) · 6 (small buttons) · 8 (CTA buttons, inputs, tabs) · 12 (content/product cards) · 16 (hero container) · pill (badges) · full (avatars/icon buttons).

Hero rarely uses photography — line-art with coral + dark-navy strokes on cream, code-editor mockups, terminal output, model comparison cards. Avatars crop to circles at 40px.

## Components (key)
- **top-nav** — cream, 64px, wordmark left, menu center-left, "Try" coral primary right.
- **button-primary** — coral bg, white text, 14/500, 12×20, h40, r8. Active darkens to #a9583e.
- **button-secondary** — cream bg, ink text, 1px hairline.
- **button-secondary-on-dark** — #252320 bg over dark cards (never inverts to light).
- **text-link** — inline coral links.
- **feature-card** — #efe9de bg, r12, 32px pad.
- **product-mockup-card-dark / code-window-card** — #181715 bg showing real product chrome / code (JetBrains Mono), r12.
- **pricing-tier-card** — cream + hairline; price in display-sm serif. **featured** flips to dark surface.
- **callout-card-coral** — full coral bg, white text, r12, 48px; inverted cream button inside.
- **badge-pill** (#efe9de) / **badge-coral** (#cc785c, uppercase caption).
- **text-input** — cream bg, r8, h40, hairline border; focus shifts border to coral + 3px coral@15% ring.
- **cta-band-coral / cta-band-dark** — pre-footer bands, r12, 64px.
- **footer** — dark (#181715), on-dark-soft text, 4-col, 64px pad. Never inverts.

## Do's and Don'ts
**Do:** anchor on cream; serif display with negative tracking; reserve coral for primary CTAs + coral callouts; show real product chrome on dark cards; alternate cream → cream-card → dark; 96px between bands.
**Don't:** cool gray/pure-white canvas; bold serif display; cool blue/cyan accent; coral everywhere; Inter for display; repeat the same surface mode in consecutive bands; add hover styling beyond primary-darkens-on-press.

## Responsive
- Mobile < 768: hamburger nav; hero h1 64→32; hero card stacks below; feature 1-up; pricing 1-up; footer 4→1.
- Tablet 768–1024: feature 2-up; pricing 2-up.
- Desktop 1024–1440: full nav; 3-up feature; 3-up pricing. Wide > 1440: caps at 1200px.
- Touch targets: primary ≥ 40×40; inputs h40. Code cards horizontal-scroll, never wrap.

## Trinity
Cream + coral + dark navy is the trinity. Don't introduce a fourth surface tone. When in doubt about emphasis: bigger Copernicus serif before bolder weight.

## Known Gaps
- Copernicus / StyreneB are licensed; use substitutes (Cormorant/EB Garamond; Inter).
- The Anthropic radial-spike mark is a brand logo asset — NOT to be reused for other products.
- Animation/transition timings and product-surface chat components are out of scope.
