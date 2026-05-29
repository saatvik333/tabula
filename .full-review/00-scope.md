# Review Scope

## Target

Entire `src/` tree of **Tabula** — a Manifest V3 browser extension (Chrome + Firefox) that replaces the new-tab page with a customizable productivity dashboard. Version 1.2.1.

- Stack: TypeScript 5.9, Vite 7, Bun (runtime + test runner), Vitest (alt test runner), jsdom
- Manifest: MV3, permissions `["storage", "notifications"]`, host permission `https://quoteslate.vercel.app/*`
- Entrypoints: `newtab.html` (chrome_url_overrides) + `options.html` (options_ui)
- No background service worker / content scripts declared in manifest snippet seen
- Tests live alongside source (`*.test.ts`)

## Files (41 source files under src/)

### src/app/
- `clock-app.ts` + test — top-level clock app composition

### src/core/
- `dom.ts` + test — DOM helpers
- `time.ts` + test — time computation
- `ticker.ts` + test — interval/animation ticker

### src/clock/
- `clock-display.ts` + test
- `digit-map.ts` + test
- `digit.ts`

### src/settings/
- `schema.ts` — settings type/shape
- `defaults.ts` + test
- `storage.ts` + tests (base, broadcast, priority)
- `theme.ts` + test
- `apply.ts` — apply settings to DOM
- `presets.ts`

### src/widgets/
- `pomodoro-widget.ts`
- `tasks-widget.ts` + test
- `notes-widget.ts` + test
- `weather-widget.ts`
- `quotes-widget.ts` + test

### src/pages/
- `newtab/index.html`, `newtab/main.ts`
- `options/index.html`, `options/main.ts`, `options/pinned-tabs.ts`

### src/assets/styles/
- `styles.content.css`, `styles.css`, `options.css`, `tokens.css`

## Flags

- Security Focus: **yes** — emphasize MV3 permissions, `chrome.storage` usage, XSS via innerHTML, message passing, CSP, external fetch (`quoteslate.vercel.app`)
- Performance Critical: **yes** — emphasize new-tab boot time, render churn (clock ticks every second), bundle size, memory leaks from listeners/intervals
- Strict Mode: no
- Framework: browser-extension MV3 + TypeScript + Vite + Bun

## Review Phases

1. Code Quality & Architecture
2. Security & Performance (extra weight per flags)
3. Testing & Documentation
4. Best Practices & Standards
5. Consolidated Report
