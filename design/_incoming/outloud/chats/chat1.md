# Voice-cloned social copilot

_Started 2026-05-31 10:46 UTC_

---

## User

Outloud
Однострочник: AI build-in-public copilot, который превращает то, что ты шипишь, в X-посты твоим голосом — не AI-голосом.

Для кого: indie SaaS-фаундер, $1k-$10k MRR, ненавидит маркетинг, постит рывками, а его посты не цепляют (3 лайка → демотивация → молчание полгода). Архетип — Jack (Friends Map), потерявший $6.4k MRR на этом цикле.

Что делает:

Захватывает голос фаундера из 5+ примеров его постов.
На входе — changelog / шипинг / короткая идея.
На выходе — 1-2 черновика X-постов в его голосе, не обезличенный AI.
Фаундер одобряет за 30 секунд → автопост в X.
Базовая аналитика: показы, лайки, новые подписчики на пост (закрывает фидбэк-луп).
Чем отличается:

Не Buffer / Typefully — это планировщики «уже-написанного». Outloud пишет за тебя.
Не ChatGPT — у него нет твоего голоса, выдаёт generic-жвачку.
Не AI-аватары / faceless-генераторы — это AI-слоп, который X не поднимает.
Outloud = единственный, кто реально звучит как сам фаундер. Это и есть твоя отстройка и ров.
MVP (Level 3): веб, только X, захват голоса, генерация, одобрение, автопост, базовая аналитика. Без расписания, мульти-платформы, командной работы, авто-без-одобрения.

Цена: $50-100/мес на старте (потолок цены Jack-а — ~$300/мес, так что есть запас вверх).

Тезис на 2029: интернет утонет в AI-слопе → аутентичный голос реального человека станет премиумом → алгоритмы X/LinkedIn будут поднимать только то, что подкреплено реальной личностью. Outloud — единственная связка живого фаундера с AI-производством.

Первое задание: не код. 5 разговоров с indie SaaS-фаундерами из TrustMRR до 6 июня. Если 1 из них согласится платить $50-100/мес за concierge-версию (ты руками пишешь треды 2 недели) — есть платящий клиент. Только после этого — MVP.

## Assistant

_[tool: view_image]_

_[tool: list_files]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: questions_v2]_

The napkin sketch is empty, so I'm working from your brief. Outloud is a sharp idea — before I design anything, I need to understand what you actually want me to make, and nail the aesthetic so we don't end up with slop.

## User

Questions answered:
- deliverable: Лендинг для сбора первых платящих / concierge-клиентов
- core_flow: Захват голоса (онбординг — вставка 5+ постов, продукт «учится»), Генерация (changelog/идея на входе → 1-2 черновика в твоём голосе), Аналитика (показы / лайки / новые подписчики, фидбэк-луп)
- aesthetic: X-native / indie hacker — тёмная тема, моноширинный акцент, build-in-public энергия
- variations: Да — несколько вариантов визуала/стиля, Да — несколько вариантов ключевого UX (как работает генерация/одобрение)
- platform: Десктоп веб (по брифу MVP — веб)
- tone: Прямой, дерзкий, indie-hacker сленг (ship, build-in-public)

## Assistant

_[tool: update_todos]_

_[tool: copy_starter_component]_

Got it. Landing page to convert TrustMRR founders into concierge clients — dark, X-native, mono-accented, build-in-public energy. Let me lock the system and build.

**Design system I'll commit to:**
- **Color:** near-black ink (`#0a0a0b`), elevated surfaces, hairline borders. One warm **signal accent** (default orange `oklch(.72 .17 47)`) — authentic/human, not the default SaaS blue. Accent is tweakable (orange / terminal-lime / electric-blue / violet, all matched L/C).
- **Type:** Space Grotesk (big bold headlines) · Instrument Sans (body) · JetBrains Mono (kickers, tags, metrics — the "// build in public" energy).
- **Centerpiece:** an interactive product demo — paste a changelog → watch it generate 1-2 drafts *in your voice* → approve → analytics tick up.
- **Conversion goal:** claim 1 of 5 founding concierge spots (scarcity, closes June 6).

Tweaks: accent color, visual style, and the approval-flow UX variant. Let me set up.

_[tool: write_file]_

Now the HTML shell with the full design system in CSS.

_[tool: write_file]_

Now the interactive centerpiece — the generation demo with three approval-flow variants, voice capture, and live analytics.

_[tool: write_file]_

Now the sections — nav, hero, the Jack story, differentiation, the 2029 thesis, and the concierge conversion block.

_[tool: write_file]_

Now the conversion block, footer, and the App that wires everything + Tweaks.

_[tool: update_todos]_

_[tool: show_html]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: save_screenshot]_

Clean load. Let me screenshot to check the layout.

_[tool: view_image]_

_[tool: save_screenshot]_

Hero looks great. Let me check the demo and lower sections.

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

Solid. Let me test the interactive generate flow, then fix a couple of wrapping nits.

_[tool: view_image]_

_[tool: str_replace_edit]_

The flow works beautifully. Two nits: the `.tag` pills wrap ("97% your / voice", "why / us"). Let me fix with `white-space: nowrap`.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: save_screenshot]_

Let me verify the lower sections (differentiation, thesis, claim).

_[tool: view_image]_

_[tool: view_image]_

_[tool: grep]_

The `.tag` pills are still wrapping ("3 of 5 spots / left"). Let me verify my nowrap edit actually landed.

_[tool: show_html]_

The edit is in the file — the screenshots were captured against the pre-edit render (save_screenshot doesn't reload). Let me reload and confirm the fix.

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: update_todos]_

_[tool: done]_

Fixed — pills hold one line now. The page is complete and the whole flow works: voice capture, generation with typewriter, three approval variants, live analytics, and the concierge conversion form. Let me hand it over.

_[tool: fork_verifier_agent]_

**Outloud landing** is live — a dark, X-native, mono-accented page built to convert TrustMRR founders into one of your 5 concierge spots.

**The flow:**
- **Hero** — "Ship in public. In your voice. Not AI's." with an interactive compose demo right under the fold — paste a changelog, watch it draft *in Jack's voice* (typewriter, voice-match badges), approve, and see analytics tick up.
- **The Jack cycle** — the build-in-public death spiral ($6.4k MRR → silence) as your problem statement.
- **How** — voice capture (paste 5 posts → fingerprint) + the analytics feedback loop.
- **Why us** — side-by-side vs Buffer/Typefully, ChatGPT (with a real slop tweet for contrast), and faceless avatars. Your voice = the moat.
- **2029 thesis** — authenticity as the new premium.
- **Claim** — the conversion centerpiece: hand-written concierge for 2 weeks, $50–100/mo, scarcity (3 of 5 spots, closes Jun 6), with a working handle/ship form.

**Tweaks** (toolbar): accent color (orange / lime / electric / violet), surface mood (signal / terminal / editorial / neon), and the **approval-flow UX variant** — `picker` (choose 1 of 2), `inline` (edit in place), `swipe` (approve/skip a stack). Try those three; they genuinely change the demo's behavior so you can feel which UX you want.

Next steps if you want them: real Calendly/DM link on the form, swap "Jack" for a real prospect's handle+posts when you demo it live, or a mobile pass.

## User

remove about 2029 section, and also 2 weeks rewrite this section. just say there $50–100 / MONTH AT LAUNCH
Get early access.
Join the founders who want to post consistently and grow an audience — in their own voice, without it eating their week.
✓
Lock in the launch price ($50–100/mo)
✓
Shape the product before it ships
✓
First access when concierge spots open
✓
Your voice, captured — no AI slop
but say that for the first 10 people the price will be 20 dollars for month instead of 50-100 and also add like before that 3/5 left

## Assistant

_[tool: str_replace_edit]_

On it — removing the 2029 section and reworking the offer into early-access framing with the first-10-founders $20 deal.Now remove the Thesis section from the render and the nav 2029 link.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Updating the hero CTAs and badge to match the new early-access framing.

_[tool: show_html]_

_[tool: str_replace_edit]_

_[tool: done]_

Done. Changes are live:

- **Hero** → "Build in public. / Stay consistent. / Get **known**."
- **2029 section** removed (and the nav link with it).
- **Offer reworked** to early access: "Get early access." with your four checkmarks, **$50–100/mo at launch**, a highlighted **first-10-founders → $20/mo** strip, and the **3 of 5 left** scarcity badge kept up top. The hero badge now reads "3 of 5 early-access spots left · first 10 founders $20/mo".

## User

change the accent color to purple or blue. decide on your own which color is better

## Assistant

_[tool: str_replace_edit]_

I'll go with **violet** — blue is the default-SaaS / literal-X cliché, whereas violet reads premium and creative, which fits a "your authentic voice" tool that's positioning authenticity as the premium. It also pops harder against the near-black.

_[tool: str_replace_edit]_

Let me also update the base CSS accent so there's no orange flash before React mounts.

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: grep]_

Stale capture — let me reload first. I also want to check the Tweaks persistence won't pin the old orange from localStorage.

_[tool: show_html]_

Good — `useTweaks` initializes straight from `TWEAK_DEFAULTS` (no localStorage pinning), so violet is now the source of truth. The orange was just a stale capture. Let me reload and confirm.

_[tool: save_screenshot]_

_[tool: view_image]_

Violet is live across the whole page — logo, badges, the "known." accent, buttons, and the demo/analytics highlights. It reads more premium and distinctive against the near-black than a default blue would. Orange, lime, and electric-blue are all still one click away in the Tweaks panel if you want to compare.

