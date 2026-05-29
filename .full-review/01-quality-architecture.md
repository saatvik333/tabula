# Phase 1: Code Quality & Architecture Review

Target: `src/` of Tabula (MV3 + TypeScript + Vite + Bun). 41 source files. 18 TS modules (non-test).

## Code Quality Findings (Phase 1A)

### Critical (3)

**C1. `any`-typed extension API surface defeats type safety in storage layer**
- File: `src/settings/storage.ts:18-21, 39-99, 144-160`
- Module-level extension bridge vars (`extensionAPI`, `syncStorage`, `localStorageArea`, `extensionOnChanged`) typed `any`. All storage ops opaque to compiler. Callback signatures, promise/callback dual-mode detection, `runtime.lastError` plumbing untyped. Unused try/catch at `invokeGet:41-59` re-throws → dead try.
- Fix: introduce `chrome.storage.StorageArea` typed shim; drop redundant try/catch.

**C2. `imageData` overlay bug — Local Storage `imageData` lost on every settings save**
- File: `src/settings/storage.ts:213-227, 312-353`
- `loadSettings` overlays `localSettings.background.imageData` onto sync settings only when `syncSettings` exists. `combined.background = {} as any` wipes sync-stored background fields (color, blur, imageUrl) when sync has no `background` key. Cast `as any` hides this.
- Fix: spread `combined.background ?? {}` then attach imageData.

**C3. Settings race — `subscribeToSettings` callback inside `start()` runs before `loadSettings()` resolves**
- File: `src/app/clock-app.ts:244-249`
- `subscribeToSettings` calls back immediately w/ `cachedSettings`, then `loadSettings().then(...)` fires later. If `hydrateFromCache` already triggered `onSettingsChanged`, subscribe-immediate re-triggers w/ same data, then loadSettings triggers AGAIN. Three settings-applied passes per cold boot. Each touches DOM + CSS vars.
- Fix: settings sequence/version flag short-circuit, or don't fire immediately when already hydrated.

### High (10)

**H1. `chrome.storage.onChanged` listener never disposed in production**
- `src/settings/storage.ts:144-160, 385-419`. Only `__resetStorageModuleForTests` removes it. Production has no dispose path. Rename to `disposeStorageModule()` or accept and document.

**H2. God class — `ClockApp` is 1206 lines, 50+ methods, 25+ private fields**
- `src/app/clock-app.ts:61-1206`. Owns layout DOM, search, pinned tabs, widgets registry, drag-and-drop, anchor math, settings diff, theme watching, ticker, options nav. Cyclomatic complexity high in `applyWidgetPosition`, `ensureLayoutEntries`, `persistWidgetLayout`, `hasAppearanceChanged`. Extract `WidgetLayoutManager` + `SettingsDiffer`.

**H3. `hasAppearanceChanged` silently misses new settings fields**
- `src/app/clock-app.ts:912-940`. Hand-rolled field-by-field comparison. Adding a palette key or background field → forget to update → preview never refreshes. Replace w/ structural diff over declared keys list.

**H4. Duplicated anchor/offset math across `clock-app.ts` and `defaults.ts` w/ different rounding**
- `clock-app.ts:519-666` vs `defaults.ts:99-162`. `cloneAnchor`+`normaliseOffset`+`sanitizeAnchor` exist in BOTH. `clock-app` keeps 2-decimal precision; `defaults` rounds to integer. 12.5px offset → 13 on next sanitize. Round-trip drift every save. Centralize to `src/settings/anchor.ts`.

**H5. Duplicated `getFaviconUrl` helper**
- `clock-app.ts:52-59` and `pinned-tabs.ts:45-52`. Identical. Move to `src/core/favicon.ts`. (Privacy note: every newtab leaks pinned hostnames to Google — see Security phase.)

**H6. Widget visibility pattern duplicated across all 5 widgets — dual `hidden + style.display`**
- Every widget runs `el.hidden = true; el.style.display = "none";`. Redundant — `hidden` is `display:none` unless overridden. Implies a CSS rule overriding `[hidden]`; should fix CSS, not paper over in JS. Or extract `setWidgetVisible(el, visible)`.

**H7. `clock-app.ts` lifecycle inconsistency — `notesWidget`+`quotesWidget` not destroyed in `stop()`**
- `clock-app.ts:251-290`. Destroys weather/pomodoro/tasks, skips notes+quotes. Notes has pending `setTimeout` debounce that fires after stop. Quotes has in-flight `AbortController` not aborted.

**H8. Ticker drift on tab throttling — interval-based ticker doesn't self-correct**
- `core/ticker.ts:5-26`. `setInterval(cb, 1000)` after initial align. Background throttle drifts ms over hours; mid-second tick + `timesEqual` causes skipped renders. Self-realign via recursive `setTimeout` w/ `1000 - (Date.now()%1000)`.

**H9. `digit.ts` `active === isCurrentlyInactive` toggle is inverted/confusing**
- `clock/digit.ts:66-69`. Conditional adds nothing — 2-arg `classList.toggle(name, force)` is idempotent. Replace whole block w/ `cell.classList.toggle("cell--inactive", !active);`.

**H10. `combineWithCurrent` duplicates default-shape knowledge already in `mergeWithDefaults`**
- `storage.ts:245-310`. Two layers of "spread + handle layout specially". Adding a widget requires editing this or silent merge failure. Replace w/ structured deep-merge utility.

### Medium (16)

- **M1.** `applySettingsToDocument` — 110-line CSS-variable wall (`apply.ts:50-166`). Extract alpha tables + themed bundles.
- **M2.** `BroadcastChannel` lazy init scattered between `notify()` + `ensureBroadcastListener()` (`storage.ts:130-184`). Single `getBroadcastChannel()` getter.
- **M3.** Clone proliferation — 3 identical `structuredClone` fallbacks + multiple `cloneAnchor` defs. Make `src/core/clone.ts`.
- **M4.** `options/main.ts` — 893 lines of manual two-way binding; `state.preset = "custom"` block duplicated 10+ times. Use a binding table.
- **M5.** Pomodoro `cyclesCompleted` mod logic doesn't re-anchor on `cyclesBeforeLongBreak` change mid-session. Minor surprise.
- **M6.** `quotes-widget` swallows all errors silently; no user-visible "service down" state. Log + status copy fix.
- **M7.** `weather-widget` empty API key still sends 401 fetch (`weather-widget.ts:29`). Guard `if (!WEATHER_API_KEY) showStatus(...)` before fetch.
- **M8.** `compressImage` busy-loops 20 attempts in one tick w/ heavy `canvas.toDataURL`. Page-unresponsive risk. Yield via `await new Promise(r=>setTimeout(r,0))` or `OffscreenCanvas`+Worker.
- **M9.** `digit-map.ts` `configCache` module-level mutable. Eagerly precompute as `ReadonlyMap`.
- **M10.** `notes-widget` timer handle type mixes `number|null` w/ test runner `NodeJS.Timeout`. Minor.
- **M11.** `pomodoro-widget` `notifyModeChange` switch w/o `default`. Add explicit `default: return;`.
- **M12.** `tasks-widget` `destroy()` no-op w/ misleading comment.
- **M13.** `clock-app.ts:1142-1164` `openOptions` uses `(browser as any)?.runtime` ×3. Build typed `getExtensionApi()` helper.
- **M14.** `pinned-tabs.ts` rebuilds all rows on every reorder. Acceptable but worth comment.
- **M15.** Magic numbers (`EDGE_ANCHOR_THRESHOLD=32`, `MAX_TASK_ITEMS=60`, `MAX_TASK_LENGTH=120`, `MAX_PINNED_TABS=12`, `MAX_IMAGE_BYTES=4MB`) spread across files. Consolidate in `src/core/limits.ts`.
- **M16.** Same as L6 — `state.preset="custom"` boilerplate.

### Low (17)

- **L1.** `core/dom.ts createElement` accepts only `className` in options bag, silently ignores rest. Either expand or collapse.
- **L2.** `core/dom.ts debounce` exported but unused. Wire it in or delete.
- **L3.** Widget controller fields hand-listed in `clock-app.ts:102-106`; should be `Map<WidgetId, WidgetController>`.
- **L4.** `storage.ts:55-59` empty `try { ... throw error }` block.
- **L5.** `weather-widget pickConditionIcon` returns same icon for "overcast" + "cloud" consecutively. Cosmetic.
- **L6.** `markCustom` boilerplate dup ×10 in options/main.ts.
- **L7.** `clock-display.ts lastRendered` minor closure smell.
- **L8.** `quotes-widget` inline `style.cursor="pointer"` should be CSS.
- **L9.** `pinned-tabs.ts updatePreview` uses `tabs[index]` — stale on reorder; safe only because reorder rebuilds rows. Add comment.
- **L10.** `clock-app.ts handlePointerUp` doesn't destructure `activeDrag` — defensive nit.
- **L11.** `StatusTone` type duplicated between `options/main.ts` + `pinned-tabs.ts`.
- **L12.** `defaults.ts coerceBackgroundType` returns single-value union — dead variability.
- **L13.** `presets.ts presetNames` hand-maintained next to `PRESETS`. Derive from keys.
- **L14.** `MAX_TASK_ITEMS=60` duplicated (see M15).
- **L15.** `notes-widget setChangeHandler` setter vs `tasks-widget` constructor-option onChange. Inconsistent.
- **L16.** `quotes-widget update()` fetches unconditionally on cache miss; no `isLoading` guard → duplicate requests.
- **L17.** Same as L15 — wiring inconsistency.

### Cross-cutting patterns

1. `any`/casts at extension boundary — single `getExtensionApi()` would fix.
2. Clone helpers ×4 — consolidate.
3. Hand-rolled deep equality ×3 (`hasAppearanceChanged`/`hasLayoutChanged`/`hasPinnedTabsChanged`) — fragile.
4. Widget visibility via dual `hidden + style.display` — CSS workaround.
5. Multiple sentinel booleans (`previousSettings`, `isPersistingLayout`, `isApplyingPreset`, `isLoading`) — replace w/ sequence counter or state machine.
6. Silent failure inconsistent — some widgets `console.warn`, others swallow.
7. Class + factory facade per widget — pick one.
8. Procedural god-functions: `mergeWithDefaults`(62), `applySettingsToDocument`(117), `compressImage`(75).
9. Widget test coverage gaps (digit, presets, theme, weather, pomodoro, pinned-tabs).
10. File-size skew: `clock-app.ts`(1206) + `options/main.ts`(893) ≈ 40% of LOC.

---

## Architecture Findings (Phase 1B)

### Critical (3)

**C1-arch. Manifest host_permissions do not cover widget network endpoints**
- `manifest.json` declares only `quoteslate.vercel.app`. Code calls:
  - `api.weatherapi.com` (`weather-widget.ts:30`)
  - `google.com/s2/favicons` (`clock-app.ts:55`, `pinned-tabs.ts:48`)
  - Arbitrary image URLs typed in options (`<img src>`, `background-image: url(...)`).
- MV3 newtab page-level `fetch` doesn't require host permission so it works today, but manifest no longer documents network surface. Breaks if migrated to service-worker.
- Fix: align manifest to actual network surface OR introduce `src/services/network/` registry of allowed origins.

**C2-arch. `ClockApp` 1207-line god-class owns 10 unrelated responsibilities**
- See Quality H2. Architectural impact: drag logic untestable in isolation; bespoke diffs per concern; adding a 6th widget touches 6 fields + 5 methods; `stop()` asymmetry invisible inside monolith.
- Fix: split into `widget-host.ts` (drag + layout + registry), `dom-shell.ts` (root skeleton + named slots), `clock-runtime.ts` (ticker+display+meridiem), `settings-binder.ts` (diff+dispatch), `pinned-tabs-view.ts` (runtime pinned). `ClockApp` shrinks to ~100-line composition root.

**C3-arch. No common widget contract; each widget is a snowflake**
- `tasks-widget` takes `onChange` in constructor option; `notes-widget` exposes `setChangeHandler()` setter — different APIs same concept.
- `pomodoro-widget` owns its own `localStorage` (`tabula:pomodoro-state`) + `BroadcastChannel` (`tabula:pomodoro-broadcast`), bypassing `settings/storage.ts`.
- `weather-widget` owns `tabula:weather-cache`; `quotes-widget` owns `tabula:quote-of-day` and ignores its declared `customQuotes` setting.
- Fix: define `Widget<TSettings>` contract in `src/widgets/widget.ts`. Inject `WidgetDeps` (storage broadcast bus, scoped logger, network service). Widgets register through registry. Pomodoro's bespoke broadcast becomes thin adapter over central bus.

### High (8)

**H1-arch. `core/` not framework-agnostic — `ticker.ts` depends on `window`**
- Hard-references `window.setInterval/clearInterval/setTimeout/clearTimeout`. Cannot reuse in service worker. Split into pure `Scheduler` interface + `defaultScheduler`. Or move ticker to `src/clock/`.

**H2-arch. `app/clock-app.ts` is misnamed — it's the newtab page application, not a clock**
- Composes search, pinned, widgets, drag, clock. Clock is one feature among many. After C2-arch split, rename to `NewtabPage` or `TabulaApp` and relocate to `src/pages/newtab/app.ts`. Drop `src/app/`.

**H3-arch. Settings storage mixes 6 concerns + module-level mutable state + `any`**
- (1) provider abstraction, (2) per-key serialization w/ imageData split, (3) `BroadcastChannel`, (4) `chrome.storage.onChanged`, (5) deep-merge of partial via `combineWithCurrent`, (6) in-memory cache + listener registry.
- `combineWithCurrent` duplicates Settings shape; `mergeWithDefaults` duplicates again. Schema changes require synchronized edits.
- imageData split policy leaks into every reader (`loadSettings:213-222`).
- Two notify paths (`notify()` + broadcast listener handler) w/ subtly different semantics.
- Split: `store-driver.ts` (typed adapter), `store-bus.ts` (fan-out), `store.ts` (public API), `merge.ts` (deep-merge).

**H4-arch. `mergeWithDefaults` does validation + merge + preset-auto-mark — three concerns**
- `defaults.ts:519-581`. Cross-product of return paths. Callers cannot opt out of preset re-detection.
- `DEFAULT_SETTINGS` defined twice in effect (BASE + `applyPresetToSettings("material", BASE)`).
- Split: `validatePartial` / `mergeWithDefaults` (pure merge) / `reconcilePreset` (policy).

**H5-arch. Image data flow lacks encapsulation — Data URL strings leak across 5 layers**
- `schema.ts`, `defaults.ts:486-507`, `storage.ts:316-322`, `apply.ts:8-16`, `options/main.ts:134-209`. Each implicitly knows the string is `data:image/...`, must strip before sync, re-inject on load, interpolate into CSS `url(...)` w/o escape.
- Fix: `BackgroundImageRef` type + ownership module w/ encoder/decoder seam + `CSS.escape`/allow-list for URL form. Compression moves out of options page into image module.

**H6-arch. Cross-tab persistence broadcast duplicated between pomodoro + settings store**
- Both implement: `localStorage` mirror + `BroadcastChannel` + `storage` event handler + per-instance source ID. Two channels per tab. Bug fixes done twice.
- Fix: extract `createPersistedStateChannel<T>({ key, channel, validate })` in `core/persisted-channel.ts`. Settings + pomodoro become typed instances. Weather cache too.

**H7-arch. Options page 893-line procedural script w/ module-level mutable state**
- 60+ module-level DOM `const`s. `state: Settings` mutated by every handler. In-file image compressor + sidebar nav init + 30+ listeners at top level. `markCustom` boilerplate ×15.
- `pinned-tabs.ts` sibling correctly factored as closure controller — same pattern should apply.
- Fix: `form-controller.ts` w/ `bindRange/bindCheckbox/bindColor/bindSelect`; move compression to `settings/image.ts`; move sidebar to `pages/options/sidebar.ts`. `main.ts` → ~150 lines.

**H8-arch. `apply.ts` single sink for theming but widget visibility lives elsewhere**
- Theme/palette/background/clock vars → `applySettingsToDocument`. Widget visibility → per-widget `update()` + `clock-app.ts:1194-1195` (widgets container) + `clock-app.ts:1126-1129` (clock container). Visibility logic across 3 layers.
- Fix: extend `apply.ts` to set body `data-*` driving CSS, OR document `apply.ts` covers only "global appearance". Half-and-half is worst of both.

### Medium (7)

- **M1-arch.** `core/dom.ts` mixes element factory + debounce (unrelated). Move `debounce` to `core/scheduling.ts`.
- **M2-arch.** Widget class+factory facade adds zero value; inconsistent w/ `pinned-tabs.ts` closure style. Pick one (closure preferred).
- **M3-arch.** `clock-app.ts` anchor math scattered across 6+ methods. Extract `createDragLayout({ widgetIds, persistence })`.
- **M4-arch.** `Settings.widgets.layout` lives alongside per-widget config → redundant fan-out (persist re-sends `weather`+`pomodoro` to avoid loss). Split into top-level `widgetLayout: WidgetLayoutEntry[]`.
- **M5-arch.** `PartialSettings` is hand-written deep-partial — drifts from `Settings`. Replace w/ `type PartialSettings = DeepPartial<Settings>`.
- **M6-arch.** `ClockApp.searchInput` field assigned + never read. Dead state (marker for monolith).
- **M7-arch.** `quotes.customQuotes` schema field sanitized/persisted/surfaced but widget never reads it. Half-implemented or remove.

### Low (5)

- **L1-arch.** `ClockApp.stop()` doesn't destroy notes+quotes (see Quality H7). Symptom of hand-maintained widget list.
- **L2-arch.** Two `getFaviconUrl` (see Quality H5).
- **L3-arch.** `tasks-widget.destroy()` no-op forced by mandatory contract. Make `destroy` optional in unified contract.
- **L4-arch.** `presets.listAvailablePresets()` uses `Object.keys` cast vs typed `presetNames`. Derive from `presetNames.filter`.
- **L5-arch.** `Settings.background.type = "image"` single-member union + `coerceBackgroundType` always returns same. Drop or implement second variant.

### Architectural strengths

1. **Pure core primitives** mostly hold shape: `core/time.ts`, `clock/digit-map.ts`, `clock/digit.ts`, `clock/clock-display.ts`.
2. **CSS-variable driven theming** — settings → DOM root style, single-sink intent is correct (modulo H8-arch).
3. **Validation in `defaults.ts`** is thorough — every field has `sanitize*`/`coerce*`. Untrusted storage normalized.
4. **`pinned-tabs.ts`** = clean closure controller; the template the rest of options should follow.
5. **Cross-tab `BroadcastChannel`** design is the right call for non-service-worker MV3.
6. **Storage fallback chain** (sync → local → window.localStorage) correct for extension+test parity.
7. **Drag anchoring strategy** (edge-snap + persisted anchor + offsets) is smart for window resize; math is sound — only location wrong.

### Dependency graph

- No circular deps. All edges expected direction.
- `core/` leaf-clean for `dom` + `time`; `ticker` violates layer (H1-arch).
- `widgets/` never imports `app/` or `settings/storage` (correct boundary). Pomodoro using `BroadcastChannel`+`localStorage` directly is a separate concern (H6-arch).
- `settings/` coherent: `schema → presets → defaults`, `schema → theme → apply`, `schema + defaults → storage`.
- `app/clock-app` = sole consumer of `widgets/*` + `core/ticker`. Justifies app layer existing, but monolith hides 5 sibling modules.
- `pages/newtab/main.ts` (10 lines) honors thin-shell intent. `pages/options/main.ts` (892) violates it.

---

## Critical Issues for Phase 2 Context

These Phase 1 findings directly feed Phase 2 (security + performance):

**Security-relevant:**
- Manifest host_permissions don't cover live endpoints (C1-arch) — store reviewer red flag.
- `apply.ts:8-16` interpolates user-supplied image URL into CSS `url(...)` w/o `CSS.escape` (H5-arch). CSS injection vector.
- `getFaviconUrl` leaks every pinned hostname to Google s2 (Quality H5).
- `extensionAPI` `any` typing (Quality C1) hides `runtime.lastError` handling — silent failures.
- Image dataURL strings flow through 5 layers w/o validation seam (H5-arch). Potential XSS sink if any layer ever drops the `data:image/` check.
- Image compression accepts options-supplied `<input type=file>` and inlines result into CSS — verify MIME guard + size guard end-to-end.
- Widgets each call out to their own external endpoints (weather API, Google favicons) — no CSP review evident.

**Performance-relevant:**
- Settings race triple-fires `onSettingsChanged` on boot (Quality C3). Each pass = full DOM + CSS-variable write.
- Ticker drift (Quality H8) → wasted re-renders mid-second under throttle.
- `compressImage` busy-loop 20 iterations of `canvas.toDataURL` (Quality M8) blocks main thread.
- Three hand-rolled diff functions in `ClockApp` (`hasAppearanceChanged`/`hasLayoutChanged`/`hasPinnedTabsChanged`) — invoked per settings change, miss new fields silently → unnecessary OR missing re-renders.
- `applySettingsToDocument` writes ~35 CSS vars unconditionally on every settings change.
- Pomodoro + weather + quotes each maintain separate `BroadcastChannel` + `localStorage` cache — duplicated cross-tab work.
- `pinned-tabs.ts` `replaceChildren` rebuild on every reorder (acceptable but check w/ max 12 items).

## Counts

- Critical: 6 (3 quality + 3 architecture)
- High: 18 (10 + 8)
- Medium: 23 (16 + 7)
- Low: 22 (17 + 5)
- **Total Phase 1: 69 findings**
