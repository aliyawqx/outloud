# Демо-видео на лендинге + видео-интро в app

**Дата:** 2026-06-30
**Статус:** утверждён к реализации

## Цель

Показать промо-видео `1782838281.MP4` в двух местах:
1. В слайде карусели на лендинге (сейчас там заглушка — видео не вставлено).
2. Как одноразовое видео-интро на `/app`, проигрываемое перед существующим welcome-туром.

Плюс кнопка повторного просмотра видео в профиле, рядом с существующей «replay tours».

## Контекст (текущее состояние)

- Видео: `promo/1782838281.MP4`, 56 МБ. Папка `promo` и все `*.mp4`/`*.MP4` исключены в `.vercelignore` — файл не попадает в деплой.
- Лендинг: `components/landing/HighlightsCarousel.tsx`, функция `VideoSlide` делает HEAD-пробу `/demo/voice-capture.mp4` и почти всегда рендерит плейсхолдер, т.к. файла нет.
- Тур-система уже готова: `driver.js`, `components/app/onboarding/TourController.tsx` запускает welcome-тур на первом визите `/app`; состояние хранится в `profiles.onboarding_state` (JSONB, ключи вида `{welcome:true}`).
- API `app/api/onboarding/tour/route.ts` принимает `{tour:<key>}` (пометить done) и `{reset:[<key>...]}` (сбросить) для **любого** строкового ключа — `setTourDone`/`resetTours` не валидируют ключи против списка туров.
- `TourController` смонтирован в `app/app/layout.tsx`; `ReplayTours` — в `app/app/profile/page.tsx`.

## Решения

| Вопрос | Решение |
|--------|---------|
| Хостинг 56 МБ видео | Vercel Blob (есть `BLOB_READ_WRITE_TOKEN`), `.vercelignore` не трогаем |
| Какое видео | `1782838281.MP4` — одно и то же на лендинге и в app |
| Когда интро в app | Перед welcome-туром, один раз, состояние в профиле |
| Кнопка replay | Рядом с «replay tours» в профиле |

## Архитектура

### 1. Хранение видео (Vercel Blob)
- Залить `promo/1782838281.MP4` в Blob под путём `demo/intro.mp4` → стабильный публичный URL.
- Новый модуль `lib/media.ts` экспортирует константу `INTRO_VIDEO_URL = '<blob-url>'`. Единый источник правды; импортируют и лендинг, и app.
- `.vercelignore` без изменений.

### 2. Лендинг — слайд карусели
- В `VideoSlide` (`HighlightsCarousel.tsx`) убрать HEAD-пробу и ветку-плейсхолдер.
- Рендерить `<video controls playsInline preload="metadata" src={INTRO_VIDEO_URL}>` внутри существующей рамки («outloud · demo», `aspect-video`).
- Постер не генерируем — первый кадр подтянется через `preload="metadata"`.

### 3. Видео-интро в app перед туром
- Новый компонент `components/app/onboarding/WelcomeVideoOverlay.tsx` — полноэкранный оверлей:
  - `<video src={INTRO_VIDEO_URL}>` с управлением.
  - Кнопка **skip** доступна всегда; кнопка **continue** появляется по событию `ended`.
- Координация video → tour (оба монтируются в `app/app/layout.tsx`):
  - Оба получают `onboarding_state` как `initialState`.
  - Если `onboarding_state.welcome_video !== true` и пользователь на `/app` → оверлей показывается.
  - `TourController` не запускает welcome-тур, пока `welcome_video` не помечен (добавить проверку: welcome ждёт `welcome_video`).
  - На **skip** или **continue**: POST `/api/onboarding/tour` `{tour:'welcome_video'}`, оверлей закрывается и диспатчит `window` CustomEvent `outloud:intro-done`.
  - `TourController` слушает `outloud:intro-done`: выставляет `doneRef.welcome_video = true` и запускает welcome-тур (без перезагрузки страницы).
  - Если `welcome_video` уже `true` → оверлея нет, тур работает как сейчас.
- БД и API без изменений: `welcome_video` — просто ещё один ключ в `onboarding_state`.

### 4. Кнопка повтора в профиле
- В `app/app/profile/page.tsx` рядом с `<ReplayTours />` добавить контрол **«watch intro»**.
- По клику: POST `{reset:['welcome_video']}` → `window.location.assign('/app')`, где оверлей проигрывается снова (паттерн `ReplayTours`).
- Реализация: либо отдельный маленький клиент-компонент `WatchIntroButton`, либо встроить рядом в существующий блок Product tours.

## Поток данных

```
Blob (demo/intro.mp4) ──URL──> lib/media.ts (INTRO_VIDEO_URL)
                                   │
                 ┌─────────────────┴───────────────────┐
            Лендинг VideoSlide                    app WelcomeVideoOverlay
                                                        │ skip/continue
                                                        ▼
                              POST /api/onboarding/tour {tour:'welcome_video'}
                                                        │ + CustomEvent
                                                        ▼
                                       TourController → welcome-тур
```

## Обработка ошибок / краевые случаи
- Blob недоступен / видео не грузится: `<video>` показывает свой нативный fallback; оверлей всё равно даёт кнопку skip, чтобы пользователь не застрял.
- POST состояния — best-effort (как в существующем `TourController.onDestroyed`): при ошибке всё равно закрываем оверлей и запускаем тур, чтобы не блокировать пользователя.
- Новый пользователь без голоса редиректится на `/app/onboarding`; интро (как и welcome-тур) проигрывается после, на `/app` — тайминг совпадает с текущим туром.

## Тестирование
- `WelcomeVideoOverlay`: показывается при `welcome_video=false`, скрыт при `true`; skip и continue оба шлют POST и диспатчат событие.
- `TourController`: не стартует welcome пока `welcome_video` не помечен; стартует по `outloud:intro-done`; при уже помеченном `welcome_video` — поведение без изменений.
- Лендинг `VideoSlide`: рендерит `<video>` с `INTRO_VIDEO_URL`, без плейсхолдера.

## Вне области (YAGNI)
- Генерация постер-картинки.
- Аналитика просмотров видео.
- Изменения `.vercelignore` и API онбординга.
