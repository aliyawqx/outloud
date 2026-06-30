# Intro Video (Landing + App) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Показать промо-видео `1782838281.MP4` в слайде карусели на лендинге и как одноразовое интро перед welcome-туром на `/app`, с кнопкой повтора в профиле.

**Architecture:** Видео заливается в Vercel Blob; URL экспортируется одной константой `INTRO_VIDEO_URL` из `lib/media.ts`. Лендинг рендерит его в существующем слайде карусели. В app новый оверлей `WelcomeVideoOverlay` проигрывает видео, помечает `welcome_video` в `profiles.onboarding_state` и через CustomEvent отдаёт управление существующему `TourController`. Гейтинг welcome-тура — чистая правка `tourForRoute` (TDD).

**Tech Stack:** Next.js (App Router), React client components, `@vercel/blob`, `driver.js`, Vitest (node env), Postgres (`pg`).

## Global Constraints

- Тексты в UI — короткие, в нижнем регистре, в стиле бренда (как в существующих турах: `'replay tours'`, `'skip'`).
- Тестовое окружение — Vitest `environment: 'node'`. Нет jsdom/testing-library → юнит-тестами покрывается только чистая логика; React-компоненты проверяются `npm run build` + вручную.
- Состояние интро хранится в существующей колонке `profiles.onboarding_state` (JSONB) под ключом `welcome_video`. Схему БД и роут `app/api/onboarding/tour/route.ts` НЕ менять — они уже принимают произвольный строковый ключ.
- `.vercelignore` НЕ менять. Видео живёт в Blob, не в репозитории.
- Один источник правды для URL видео — `lib/media.ts`.

---

## File Structure

- Create: `scripts/upload-intro.ts` — одноразовый аплоад видео в Blob, печатает публичный URL.
- Create: `lib/media.ts` — экспорт `INTRO_VIDEO_URL`.
- Create: `components/app/onboarding/tours.test.ts` — юнит-тесты гейтинга.
- Modify: `components/app/onboarding/tours.ts` — гейт welcome по `welcome_video` + хелпер `shouldShowIntro`.
- Create: `components/app/onboarding/WelcomeVideoOverlay.tsx` — оверлей с видео.
- Modify: `components/app/onboarding/TourController.tsx` — слушатель `outloud:intro-done`.
- Modify: `app/app/layout.tsx` — монтирование оверлея.
- Modify: `components/landing/HighlightsCarousel.tsx` — слайд использует `INTRO_VIDEO_URL`.
- Modify: `app/app/profile/page.tsx` + Create `components/app/onboarding/WatchIntroButton.tsx` — кнопка повтора.

---

### Task 1: Залить видео в Blob и зафиксировать URL

**Files:**
- Create: `scripts/upload-intro.ts`
- Create: `lib/media.ts`

**Interfaces:**
- Produces: `INTRO_VIDEO_URL: string` из `lib/media.ts` — публичный URL видео в Blob.

- [ ] **Step 1: Убедиться, что токен Blob доступен локально**

Run: `vercel env pull .env.local` (если `.env.local` ещё нет токена)
Expected: файл содержит `BLOB_READ_WRITE_TOKEN=...`

- [ ] **Step 2: Написать скрипт аплоада**

Create `scripts/upload-intro.ts`:

```ts
import { readFile } from 'node:fs/promises'
import { put } from '@vercel/blob'

// One-off: upload the promo clip to Vercel Blob and print its public URL.
// Run: BLOB_READ_WRITE_TOKEN=... npx tsx scripts/upload-intro.ts
async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not set')
  const data = await readFile('promo/1782838281.MP4')
  const blob = await put('demo/intro.mp4', data, {
    access: 'public',
    contentType: 'video/mp4',
    token,
    allowOverwrite: true,
  })
  console.log(blob.url)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 3: Запустить аплоад**

Run: `set -a; source .env.local; set +a; npx tsx scripts/upload-intro.ts`
Expected: одна строка с URL вида `https://<id>.public.blob.vercel-storage.com/demo/intro.mp4`

- [ ] **Step 4: Проверить, что видео отдаётся**

Run: `curl -sI "<URL-из-step-3>" | head -1`
Expected: `HTTP/2 200`

- [ ] **Step 5: Записать константу**

Create `lib/media.ts` (подставить реальный URL из step 3):

```ts
// Public URL of the onboarding/demo clip, hosted on Vercel Blob (kept out of the
// repo + deploy bundle — see .vercelignore). Single source of truth for both the
// landing carousel and the in-app intro overlay. Refresh by re-running
// scripts/upload-intro.ts and pasting the new URL here.
export const INTRO_VIDEO_URL = 'https://<id>.public.blob.vercel-storage.com/demo/intro.mp4'
```

- [ ] **Step 6: Проверить сборку и закоммитить**

Run: `npm run build`
Expected: успешная сборка без ошибок типов.

```bash
git add scripts/upload-intro.ts lib/media.ts
git commit -m "Add intro video to blob"
```

---

### Task 2: Гейтинг welcome-тура по welcome_video (TDD)

**Files:**
- Modify: `components/app/onboarding/tours.ts`
- Test: `components/app/onboarding/tours.test.ts`

**Interfaces:**
- Consumes: ничего нового.
- Produces:
  - `tourForRoute(pathname: string, done: Record<string, boolean>): TourKey | null` — на `/app` возвращает `null`, пока `done.welcome_video` не `true`.
  - `shouldShowIntro(done: Record<string, boolean>): boolean` — `true`, когда `done.welcome_video !== true`.

- [ ] **Step 1: Написать падающие тесты**

Create `components/app/onboarding/tours.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { tourForRoute, shouldShowIntro } from './tours'

describe('shouldShowIntro', () => {
  it('true when welcome_video not seen', () => {
    expect(shouldShowIntro({})).toBe(true)
  })
  it('false once welcome_video is done', () => {
    expect(shouldShowIntro({ welcome_video: true })).toBe(false)
  })
})

describe('tourForRoute /app intro gating', () => {
  it('no tour while intro video is pending', () => {
    expect(tourForRoute('/app', {})).toBeNull()
  })
  it('welcome fires after intro video is seen', () => {
    expect(tourForRoute('/app', { welcome_video: true })).toBe('welcome')
  })
  it('new_post fires when welcome also done', () => {
    expect(tourForRoute('/app', { welcome_video: true, welcome: true })).toBe('new_post')
  })
  it('other routes are unaffected by welcome_video', () => {
    expect(tourForRoute('/app/voices', {})).toBe('voices')
  })
})
```

- [ ] **Step 2: Запустить тесты — убедиться, что падают**

Run: `npx vitest run components/app/onboarding/tours.test.ts`
Expected: FAIL — `shouldShowIntro is not a function` и провал гейтинга на `/app`.

- [ ] **Step 3: Реализовать гейт и хелпер**

В `components/app/onboarding/tours.ts` заменить тело `tourForRoute` для `/app` и добавить хелпер. Найти строку:

```ts
  if (pathname === '/app') return !done.welcome ? 'welcome' : !done.new_post ? 'new_post' : null
```

заменить на:

```ts
  if (pathname === '/app') {
    // The intro video plays first; the welcome tour waits until it's dismissed.
    if (!done.welcome_video) return null
    return !done.welcome ? 'welcome' : !done.new_post ? 'new_post' : null
  }
```

В конец файла добавить:

```ts
/** Whether the one-time intro video should still play (before any /app tour). */
export function shouldShowIntro(done: Record<string, boolean>): boolean {
  return done.welcome_video !== true
}
```

- [ ] **Step 4: Запустить тесты — убедиться, что проходят**

Run: `npx vitest run components/app/onboarding/tours.test.ts`
Expected: PASS (6 тестов).

- [ ] **Step 5: Коммит**

```bash
git add components/app/onboarding/tours.ts components/app/onboarding/tours.test.ts
git commit -m "Gate welcome tour behind intro video"
```

---

### Task 3: Компонент WelcomeVideoOverlay

**Files:**
- Create: `components/app/onboarding/WelcomeVideoOverlay.tsx`

**Interfaces:**
- Consumes: `INTRO_VIDEO_URL` из `lib/media.ts`; `shouldShowIntro` из `./tours`.
- Produces: `<WelcomeVideoOverlay initialState={Record<string, boolean>} />` (client). При закрытии: POST `/api/onboarding/tour` `{tour:'welcome_video'}` и `window.dispatchEvent(new CustomEvent('outloud:intro-done'))`.

- [ ] **Step 1: Создать компонент**

Create `components/app/onboarding/WelcomeVideoOverlay.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { INTRO_VIDEO_URL } from '@/lib/media'
import { shouldShowIntro } from './tours'

// One-time intro video shown on first /app visit, BEFORE the welcome tour. Skip is
// always available; a "continue" button appears once the clip ends. Either action
// marks welcome_video done (best-effort) and hands off to TourController via the
// outloud:intro-done event so the welcome tour starts with no page reload.
export function WelcomeVideoOverlay({ initialState }: { initialState: Record<string, boolean> }) {
  const [open, setOpen] = useState(() => shouldShowIntro(initialState))
  const [ended, setEnded] = useState(false)
  if (!open) return null

  function dismiss() {
    setOpen(false)
    fetch('/api/onboarding/tour', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tour: 'welcome_video' }),
    }).catch(() => {})
    window.dispatchEvent(new CustomEvent('outloud:intro-done'))
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-surface shadow-2xl">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Skip intro"
          className="absolute right-3 top-3 z-10 rounded-full border border-border-muted bg-surface/85 px-3 py-1.5 font-code-label text-code-label text-on-surface-variant backdrop-blur transition-colors hover:text-on-surface"
        >
          skip
        </button>
        <video
          className="aspect-video w-full bg-black"
          src={INTRO_VIDEO_URL}
          controls
          autoPlay
          playsInline
          onEnded={() => setEnded(true)}
        />
        {ended && (
          <div className="flex justify-end border-t border-border-muted px-5 py-3">
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex items-center gap-1.5 rounded-full bg-electric-indigo px-4 py-2 font-code-label text-code-label text-white transition-opacity hover:opacity-90"
            >
              continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Проверить сборку**

Run: `npm run build`
Expected: успешная сборка без ошибок типов.

- [ ] **Step 3: Коммит**

```bash
git add components/app/onboarding/WelcomeVideoOverlay.tsx
git commit -m "Add welcome video overlay"
```

---

### Task 4: Слушатель события в TourController + монтирование оверлея

**Files:**
- Modify: `components/app/onboarding/TourController.tsx`
- Modify: `app/app/layout.tsx`

**Interfaces:**
- Consumes: событие `outloud:intro-done`; `WelcomeVideoOverlay`.
- Produces: после `outloud:intro-done` `TourController` выставляет `doneRef.welcome_video = true` и запускает welcome-тур для текущего `/app`.

- [ ] **Step 1: Добавить слушатель события в TourController**

В `components/app/onboarding/TourController.tsx` после существующего `useEffect`, зависящего от `pathname` (заканчивается `}, [pathname])`), добавить новый эффект перед `return null`:

```tsx
  // The intro video hands off here: once it's dismissed, mark welcome_video done in
  // our local mirror and (re)evaluate the current route's tour so welcome can fire.
  useEffect(() => {
    function onIntroDone() {
      doneRef.current.welcome_video = true
      if (runningRef.current) return
      const key = tourForRoute(window.location.pathname, doneRef.current)
      if (key) startRef.current(key)
    }
    window.addEventListener('outloud:intro-done', onIntroDone)
    return () => window.removeEventListener('outloud:intro-done', onIntroDone)
  }, [])
```

- [ ] **Step 2: Смонтировать оверлей в layout рядом с TourController**

В `app/app/layout.tsx` добавить импорт рядом с импортом `TourController`:

```tsx
import { WelcomeVideoOverlay } from '@/components/app/onboarding/WelcomeVideoOverlay'
```

Найти строку:

```tsx
      <TourController initialState={profile?.onboardingState ?? {}} />
```

и добавить перед ней:

```tsx
      <WelcomeVideoOverlay initialState={profile?.onboardingState ?? {}} />
```

- [ ] **Step 3: Проверить сборку**

Run: `npm run build`
Expected: успешная сборка без ошибок типов.

- [ ] **Step 4: Ручная проверка потока**

Run: `npm run dev`, затем:
1. Сбросить состояние: в профиле нажать будущую кнопку нельзя (ещё нет) — вместо этого временно выполнить в БД или через `/api/onboarding/tour` POST `{reset:['welcome_video','welcome']}` и открыть `/app`.
2. Ожидается: показывается оверлей с видео. Клик **skip** → оверлей закрывается, через мгновение стартует welcome-тур.
3. Перезагрузить `/app` → оверлей больше не появляется (welcome_video помечен).

Expected: поведение совпадает с описанным.

- [ ] **Step 5: Коммит**

```bash
git add components/app/onboarding/TourController.tsx app/app/layout.tsx
git commit -m "Wire intro video to welcome tour"
```

---

### Task 5: Видео в слайде карусели на лендинге

**Files:**
- Modify: `components/landing/HighlightsCarousel.tsx`

**Interfaces:**
- Consumes: `INTRO_VIDEO_URL` из `lib/media.ts`.

- [ ] **Step 1: Упростить VideoSlide до прямого видео**

В `components/landing/HighlightsCarousel.tsx`:

Добавить импорт в начало файла (после существующих импортов):

```tsx
import { INTRO_VIDEO_URL } from '@/lib/media'
```

Удалить хук-пробу и плейсхолдер: заменить всю функцию `VideoSlide` (от `function VideoSlide() {` до её закрывающей `}`) на:

```tsx
// A short demo-video slide playing the hosted intro clip.
function VideoSlide() {
  return (
    <div className="glass-card overflow-hidden rounded-3xl border-white/10 shadow-2xl">
      <div className="flex items-center gap-2 border-b border-border-muted px-5 py-3">
        <span className="h-3 w-3 rounded-full bg-error/40" />
        <span className="h-3 w-3 rounded-full bg-secondary/40" />
        <span className="h-3 w-3 rounded-full bg-electric-indigo/40" />
        <span className="ml-3 font-code-label text-code-label text-on-surface-variant">outloud · demo</span>
      </div>
      <div className="relative aspect-video bg-surface-container-lowest">
        <video
          className="h-full w-full object-cover"
          src={INTRO_VIDEO_URL}
          controls
          playsInline
          preload="metadata"
        />
      </div>
    </div>
  )
}
```

Если после удаления `useState`/`useEffect` стали неиспользуемыми — убрать их из импорта `react` в строке 3 (оставить `type ReactNode`).

- [ ] **Step 2: Проверить сборку (поймает неиспользуемые импорты)**

Run: `npm run build`
Expected: успешная сборка без ошибок и предупреждений о неиспользуемых импортах.

- [ ] **Step 3: Ручная проверка**

Run: `npm run dev`, открыть лендинг `/`, пролистать карусель до слайда «See it in action».
Expected: проигрывается видео из Blob, заглушки нет.

- [ ] **Step 4: Коммит**

```bash
git add components/landing/HighlightsCarousel.tsx
git commit -m "Play intro video in landing carousel"
```

---

### Task 6: Кнопка «watch intro» в профиле

**Files:**
- Create: `components/app/onboarding/WatchIntroButton.tsx`
- Modify: `app/app/profile/page.tsx`

**Interfaces:**
- Consumes: ничего нового.
- Produces: `<WatchIntroButton />` (client) — POST `/api/onboarding/tour` `{reset:['welcome_video']}` затем `window.location.assign('/app')`.

- [ ] **Step 1: Создать кнопку**

Create `components/app/onboarding/WatchIntroButton.tsx`:

```tsx
'use client'

import { useState } from 'react'

// Profile control to replay the one-time intro video. Clears welcome_video on the
// server, then hard-navigates to /app where WelcomeVideoOverlay plays it again.
export function WatchIntroButton() {
  const [busy, setBusy] = useState(false)

  async function watch() {
    setBusy(true)
    try {
      await fetch('/api/onboarding/tour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: ['welcome_video'] }),
      })
    } catch {
      // best-effort; still navigate so the user isn't stuck
    }
    window.location.assign('/app')
  }

  return (
    <button
      type="button"
      onClick={watch}
      disabled={busy}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border-muted px-4 py-2 font-code-label text-code-label text-on-surface transition-colors hover:border-electric-indigo disabled:opacity-60"
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[16px]">play_circle</span>
      {busy ? 'opening…' : 'watch intro'}
    </button>
  )
}
```

- [ ] **Step 2: Вставить кнопку рядом с ReplayTours**

В `app/app/profile/page.tsx` добавить импорт рядом с импортом `ReplayTours`:

```tsx
import { WatchIntroButton } from '@/components/app/onboarding/WatchIntroButton'
```

Найти строку `<ReplayTours />` и добавить сразу под ней:

```tsx
      <div className="mt-3 flex justify-end">
        <WatchIntroButton />
      </div>
```

- [ ] **Step 3: Проверить сборку**

Run: `npm run build`
Expected: успешная сборка без ошибок типов.

- [ ] **Step 4: Ручная проверка**

Run: `npm run dev`, открыть `/app/profile`, нажать **watch intro**.
Expected: переход на `/app`, оверлёй с видео проигрывается снова.

- [ ] **Step 5: Коммит**

```bash
git add components/app/onboarding/WatchIntroButton.tsx app/app/profile/page.tsx
git commit -m "Add watch intro button to profile"
```

---

## Self-Review

**Spec coverage:**
- Хостинг в Blob → Task 1. ✓
- Лендинг-слайд использует видео → Task 5. ✓
- Видео-интро перед welcome-туром, один раз, состояние в профиле → Tasks 2–4. ✓
- Координация video→tour через `outloud:intro-done` → Task 4. ✓
- Кнопка повтора рядом с replay tours → Task 6. ✓
- БД/API/.vercelignore не трогаем → соблюдено во всех задачах. ✓

**Placeholder scan:** `<URL-из-step-3>` и `https://<id>...` — это реальные значения, получаемые из аплоада в Task 1 (не дизайн-заглушки). Прочих TODO/«handle errors» нет.

**Type consistency:** `tourForRoute`, `shouldShowIntro`, `INTRO_VIDEO_URL`, событие `outloud:intro-done`, ключ `welcome_video` — имена согласованы между задачами 1–6.
