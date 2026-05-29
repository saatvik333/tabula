# Phase 2: Security & Performance Review

Flags applied: `--security-focus` + `--performance-critical`. Both phases got extra weight.

Target: Tabula MV3 extension, 18 non-test TS files. Bundle (verified `dist/`): newtab.js 44 KB + options.js 20 KB + shared storage.js 20 KB + ~40 KB CSS. Zero runtime deps.

---

## Security Findings (Phase 2A) — 27 total

### Critical (3)

**C-SEC-1. WeatherAPI key baked into every shipped bundle**
- `weather-widget.ts:29` uses `import.meta.env["VITE_WEATHER_API_KEY"]` → Vite inlines at build. Verified key `c921752e6e4a4d68b04162048252210` present in `dist/assets/newtab.js`.
- CWE-798 + CWE-312. CVSS ~5.3 (quota/TOS, not user-data breach). Marked Critical = irrevocable per release + store-reviewer flag + extractable by anyone with the extension.
- Attack: extract from DevTools → use until 1M/mo quota exhausted → all users see "Weather unavailable" until next release.
- Fix priority: (1) short-term rotate + cap monthly + restrict by referer to `chrome-extension://*`; (2) right-fix: proxy via your own server (CF Worker / Vercel Function); (3) alt: open-meteo.com (no key).

**C-SEC-2. CSS `url()` interpolation of untrusted strings**
- `apply.ts:7-16` — `formatBackgroundImage` builds `url(${imageData})` / `url(${trimmed})` raw. Written via `setProperty("--tabula-background-image", ...)` consumed by `background-image`.
- CWE-79 / CWE-95 adjacent. CVSS ~6.1 under storage-poisoning model.
- `imageData` requires `data:image/` prefix at sanitize (mitigates one variant). `imageUrl` has NO protocol check — `sanitizeString` only trims. `isValidUrl` exists in `defaults.ts:211` but not applied to `imageUrl`.
- Attack: `imageUrl = "x); background: red; --x: url(y"` — breaks out of `url()` arg.
- Fix:
```ts
const ALLOWED_PROTOCOLS = new Set(["https:"]);
const ALLOWED_DATA = /^data:image\/(png|jpe?g|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/;
const safeImageUrl = (raw: string): string | null => {
  try { const u = new URL(raw); return ALLOWED_PROTOCOLS.has(u.protocol) ? u.toString() : null; }
  catch { return null; }
};
// then: return `url("${CSS.escape(safe)}")`;
```

**C-SEC-3. Pinned-tab href rendered without render-time re-validation + no rel=noopener**
- `clock-app.ts:1080-1116`. `item.href = tab.url` directly from storage. No `rel="noopener noreferrer"`, no `target`. Today `target=_self` so reverse-tabnabbing inert; if future change adds `target=_blank`, becomes real `window.opener` primitive.
- Sanitizer (`sanitizePinnedTab` defaults.ts:220-244) currently gates render via `mergeWithDefaults` chain. Defense-in-depth: re-validate at render.
- Also: `tab.icon` → `image.src = iconSrc` at `clock-app.ts:1093` and `pinned-tabs.ts:194` with NO `isValidUrl` (only `sanitizeString`). Tracking-pixel via `<img src="http://attacker/?...">` works.
- Fix: re-run `isValidPinnedUrl` before `href`. Set `rel="noopener noreferrer"` always. Apply `isValidUrl(["https:"])` to `tab.icon` in sanitizer + render guard.

### High (6)

**H-SEC-1. `tab.icon` URL not protocol-validated → arbitrary img src** — see C-SEC-3 bullet. CWE-829.

**H-SEC-2. Manifest `host_permissions` understate network surface**
- `manifest.json:13` lists only `quoteslate.vercel.app`. Live fetches:
  - `api.weatherapi.com` (weather-widget.ts:30)
  - `www.google.com/s2/favicons` (clock-app.ts:55, pinned-tabs.ts:48)
  - User-supplied image URL (CSS `background-image`)
  - User-supplied pinned-tab icon URL (`<img>`)
- MV3 newtab/options can `fetch()` cross-origin without host_permissions, so works today — but: AMO/CWS reviewers expect docs; future service-worker migration breaks; install-dialog hides data flow.
- Fix: declare `weatherapi.com`, `www.google.com/s2/favicons*` explicitly. User-image hosts unenumerable — privacy-policy note.

**H-SEC-3. `extensionAPI` `any` masks `runtime.lastError` + quota signals**
- `storage.ts:18-21, 39-99`. Callbacks consult `extensionAPI?.runtime?.lastError` but type system can't verify. Promise path swallows quota rejections to `console.warn` (lines 200, 209, 328, 343).
- Concrete: `chrome.storage.sync` QUOTA_BYTES_PER_ITEM = 8 KiB. Notes content is unbounded (`defaults.ts:360` — no size cap). Pasting megabyte of notes → silent sync failure → local fallback succeeds so user sees notes, but **cross-device data loss** w/o user feedback.
- Fix: type `chrome.storage.StorageArea`. Cap notes at 32 KiB at sanitization. Surface UI banner on sync-write failure.

**H-SEC-4. Notification content user-controllable → phishing/spoof primitive**
- `pomodoro-widget.ts:51-65, 481-500`. `notifications.focusTitle/.focusBody/...` trim-only sanitize, passed verbatim to `new Notification(title, { body })`. OS-level UI renders extension name attribution but no URL.
- Attack (storage-poisoning preconditioned): `focusTitle = "Your bank: action required"`, `focusBody = "Verify https://evil"`. User-likelihood low but high-impact if achieved.
- Fix: hard-cap title 80 / body 240 chars; strip `\n` + control chars; prefix `Tabula • ${title}` constant.

**H-SEC-5. `BroadcastChannel("tabula:settings")` accepts foreign-origin envelope-less messages**
- `storage.ts:172-179`. Same-origin only — Tabula's two pages share extension origin so safe today. Defense-in-depth: add `{ v: 1, payload }` envelope and reject mismatched versions.

**H-SEC-6. No CSP declared; remote Google Fonts may violate MV3 default + privacy beacon**
- `manifest.json` has no `content_security_policy.extension_pages`. MV3 default `script-src 'self'; object-src 'self'` is strict — verified zero dynamic-string code-eval primitives in src/.
- `pages/newtab/index.html:14-16` + `pages/options/index.html:8-13` load Google Fonts CSS. Under default CSP `style-src 'self'` inherited from `default-src 'self'`, may be silently blocked depending on Chrome version.
- Fix: bundle woff2 locally (drops style-src carve-out + privacy ping). OR declare explicit CSP `style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com`.

### Medium (10)

- **M-SEC-1.** `options/main.ts:416` clears preset container via HTML-string property assignment to empty string. Empty value is safe (no parse), but use `replaceChildren()` for consistency — prevents future maintainer copying the pattern with dynamic content.
- **M-SEC-2.** `image.onerror` writes back to storage (`pinned-tabs.ts:198 clearIconAt`) — network-mitm attacker DNS-blocking Google can persist icon-loss. Use display-only fallback.
- **M-SEC-3.** Prefer `addEventListener` over direct `image.onerror =` assignment.
- **M-SEC-4.** `notifications` manifest permission declared but code uses Web Notifications API (`new Notification(...)`), not `chrome.notifications`. Drop permission OR switch to `chrome.notifications.create()` (MV3-idiomatic, no per-page gesture).
- **M-SEC-5.** Pinned-tab `title` not length-capped in `sanitizePinnedTab` (only at input layer `slice(0,40)`). Multi-MB title = DOM/a11y DoS. Cap to 200 chars at sanitization.
- **M-SEC-6.** `quotes-widget` trusts third-party JSON; rendered via `textContent` (XSS-safe). `customQuotes` schema field never read (Phase 1 M7-arch) — implementing local quotes removes third-party dependency.
- **M-SEC-7.** `chrome.storage.sync` persists notes/tasks/weather location/pinned URLs/palette colors/image URL across vendor sync infrastructure. Disclose in privacy policy.
- **M-SEC-8.** `localStorage` weather cache per-origin — N/A by design.
- **M-SEC-9.** `compressImage` `FileReader.readAsDataURL` runs BEFORE the `MAX_IMAGE_BYTES = 4 MB` check → 1 GB pathological file allocates 1 GB+. Add `file.size > 20 MB` early bail before `readAsDataURL`.
- **M-SEC-10.** Search submission: `window.location.href = builder(query)` uses `encodeURIComponent` from fixed `SEARCH_ENGINES` allow-list via `coerceSearchEngine`. Safe.

### Low (8)

- L-SEC-1. 26 `console.warn`/`console.error` calls leak internals. Strip via Vite `define` if scaling.
- L-SEC-2. `Math.random()` fallback for task/pin IDs — not security identifiers. N/A.
- L-SEC-3. `loading="lazy"` no-op in newtab viewport.
- L-SEC-4. `window.open` already has `noopener`.
- L-SEC-5. Dev-only files not shipped.
- L-SEC-6. No iframes.
- L-SEC-7. No service worker = no background attack surface.
- L-SEC-8. Inline `style.cursor` allowed under default CSP.

### Privacy disclosure summary (7 endpoints leak data; none disclosed)

| Endpoint | Learns | Frequency | Consent | Action |
|---|---|---|---|---|
| fonts.googleapis.com/gstatic.com | IP, UA, newtab-open time | Every newtab | None | **Bundle locally** |
| google.com/s2/favicons | Every pinned hostname + IP + time | Every newtab × pin | None | **Self-cache at pin-time** |
| api.weatherapi.com | User location + IP | 15-min when enabled | Implicit | Disclose; proxy (fixes C-SEC-1) |
| quoteslate.vercel.app | IP, request timing | 1/day | Implicit | Disclose; ship local fallback |
| User image URL host | This user has Tabula + IP | Every newtab | Explicit | Disclose at input |
| User pinned-icon host | Same | Every newtab | Explicit | Same |
| chrome.storage.sync (vendor) | All settings ex imageData | On change | Implicit | Disclose synced fields |

### Dependency notes

- `package.json` shows **zero runtime deps**. `dist/` payload = pure first-party + inlined env. Strong posture.
- `bun pm audit` not implemented this Bun version; `npm audit` fails w/o lockfile. Recommend `npm i --package-lock-only && npm audit --json` once, OR `bun pm scan` config in `bunfig.toml`, OR GH Actions `dependency-review-action`.
- devDeps reviewed manually: archiver 7, chrome-webstore-upload-cli 2, jsdom 27, vite 7, vitest 3, web-ext 7, @types/chrome 0.0.266, @types/node 24, ts 5.9, bun-types latest. All recent; not runtime-shipped.

---

## Performance Findings (Phase 2B) — 34 total

### Critical (4)

**CRIT-1. Boot triple-fires `onSettingsChanged` → 132 CSS-var writes pre-paint**
- Verified sequence at `clock-app.ts:237-249`:
  1. `hydrateFromCache()` → `onSettingsChanged(snapshot)` [PASS 1]
  2. `subscribeToSettings(cb)` (`storage.ts:376-378` fires `cb(cachedSettings)` immediately) [PASS 2]
  3. `loadSettings().then(...)` resolves → `onSettingsChanged(settings)` [PASS 3]
- Each pass: 3 hand-rolled diffs + possibly `loadWidgetLayout` + `refreshTheme()` → `applySettingsToDocument` (**44** `setProperty` calls/pass, not 35 as Phase 1 estimated) + `updateSearch` + `updateTagline` + `updateClockVisibility` + `updatePinnedTabs` (full rebuild) + 5 × `widget.update(settings)` + `applyWidgetLayout()` (5 widgets re-positioned, forced layout) + `render(true)`.
- 3 × 44 = **132 setProperty calls pre-paint**. 3× full widget tree rebuild. 3× pinned-tabs rebuild.
- Impact: **30-80 ms blocking before first paint** cold boot. Visible flicker at 50-100 ms if cache stale.
- Fix:
```ts
let settingsVersion = 0;
export const notify = (s: Settings) => { settingsVersion++; /* ... */ };
export const getSettingsVersion = () => settingsVersion;
// in onSettingsChanged:
if (getSettingsVersion() === this.lastVersion) return;
this.lastVersion = getSettingsVersion();
```

**CRIT-2. `compressImage` blocks main thread 2-6 s**
- `options/main.ts:134-209`. `tryCompress` recurses **synchronously up to 20 times** after `img.onload`. Each iter: full `canvas.toDataURL('image/jpeg', q)` encode. On 4 MB photo (3000×2000+) → 80-300 ms per call. Worst case 20 × 200 ms ≈ **4 s unresponsive**.
- Wrapping Promise doesn't help — recursion in same microtask.
- Fix:
```ts
const yieldToMain = () => new Promise<void>(r => setTimeout(r, 0));
// inside recursion: await yieldToMain(); before scale -= 0.15;
```
Also: start scale from `sqrt(targetBytes / initialBytes)` → 2-3 iters enough. Reuse one canvas across iterations.

**CRIT-3. Pomodoro `tick()` writes localStorage + broadcasts every second while running**
- `pomodoro-widget.ts:382-395, 274-287`. 60 writes/min while timer runs. Across 5 open newtabs: 5 × (write + 4 inbound broadcasts) = **25 storage events/sec handled**. Each inbound `syncExternalState` does full state normalize + re-render.
- Fix: persist + broadcast only on phase transitions (running/paused/mode change/skip/reset). Tick updates UI only:
```ts
private tick() {
  const now = Date.now();
  this.state.remainingMs = Math.max(0, this.state.remainingMs - (now - this.state.lastUpdated));
  this.state.lastUpdated = now;
  if (this.state.remainingMs === 0) { this.advanceState(this.state); this.notifyModeChange(); }
  else this.render();  // NO persistState
}
```

**CRIT-4. Quotes widget fires 3 concurrent fetches on boot cache miss**
- `quotes-widget.ts:101-121, 138-161`. `update()` doesn't check `isLoading` (only click handler does). Combined w/ CRIT-1: 3 passes × cache miss → 3 concurrent fetches to `quoteslate.vercel.app/api/quotes/random`. Subsequent aborts kick after handshake already started → **3 TCP/TLS handshakes wasted**.
- Fix: guard `if (this.isLoading) return;` at `update()` entry (in addition to CRIT-1 fix).

### High (10)

- **HIGH-1.** Ticker drift — `setInterval(cb, 1000)` no self-realign (`core/ticker.ts:5-26`). Under background throttle, drifts ms/hour → mid-second tick + `timesEqual` skips render. Fix: recursive `setTimeout(tick, 1000 - Date.now()%1000)`.
- **HIGH-2.** `applySettingsToDocument` writes **44** CSS vars unconditionally (`apply.ts:50-166`). `hexToRgb` runs per call (no memo). Fix: cache last-applied map; skip writes when unchanged.
- **HIGH-3.** `updateWidgets` re-positions all 5 widgets on every settings change. `applyWidgetLayout` calls `getBoundingClientRect()`-equivalent (`getWidgetDimensions`) inside loop → **forced layout per widget**. Read-then-write thrash. With CRIT-1: 75 widget-position style writes per boot.
- **HIGH-4.** Hand-rolled diffs (`hasAppearanceChanged`/`hasLayoutChanged`/`hasPinnedTabsChanged` at `clock-app.ts:912-986`) miss `clock.format`, `clock.showSeconds`, `clock.enabled` — latent correctness bug if any theme depends on format. Replace w/ structural diff via `JSON.stringify` or schema-keyed.
- **HIGH-5.** Pinned-tabs full rebuild on every change (`clock-app.ts:1065-1124`) + every `<img>` fires `s2/favicons` (privacy + perf). Fix: keyed diff-and-patch; `<link rel="preconnect" href="https://www.google.com">`.
- **HIGH-6.** `chrome.storage.onChanged` listener never disposed in production (`storage.ts:144-160`). HMR/test re-runs accumulate. Production page-scoped so bounded.
- **HIGH-7.** Weather widget `update()` triple-fires from CRIT-1 → 3 concurrent fetches against weatherapi (first 2 aborted). Wastes API quota. Fix: in-flight guard + CRIT-1.
- **HIGH-8.** Notes typing writes `chrome.storage.sync` at 500 ms debounce = 2 writes/sec — exactly at Chrome sync rate-limit (2/sec + 120/min + 1800/hr). Sustained typing → silent reject. Fix: 2 s debounce OR route notes to `chrome.storage.local` only.
- **HIGH-9.** Pomodoro `advanceState` + `notifyModeChange` cause double textContent mutation per transition tick. Minor; fix via CRIT-3 fix.
- **HIGH-10.** Drag-end persists full sync+local write per pointer-up. Diff at `clock-app.ts:835` prevents no-op but sub-pixel jitter can tip. Add 250 ms debounce.

### Medium (11)

- **MED-1.** `mergeWithDefaults` called 3+ times on boot (~200-500 µs each).
- **MED-2.** `cloneSettings` called twice per `notify` (once for snapshot, once per listener) — 50-200 µs/clone. Either drop defensive clones or clone-once + treat readonly.
- **MED-3.** `configCache` (`digit-map.ts:111-130`) lazy-builds on first render. Precompute as `ReadonlyMap` at module init.
- **MED-4.** Clock per-tick: 6 digits × 24 cells, avg ~60 style/class writes/sec. Inverted toggle at `digit.ts:66-69` already idempotent (`classList.toggle(name, force)` is) — simplify.
- **MED-5.** `combineWithCurrent` allocates full Settings tree per `updateSettings` even on single-field patches. 100-300 µs/update.
- **MED-6.** Settings stored as single ~5-10 KB blob in `chrome.storage.sync` — close to 8 KB per-item limit. **Latent quota risk** w/ large pomodoro notif copy + many pinned tabs. Split into per-section keys.
- **MED-7.** `getFaviconUrl` fires 12 third-party requests cold-load. Add `<link rel="preconnect" href="https://www.google.com">` OR proxy through bundled cache.
- **MED-8.** Options `setStatus` keystroke writes coalesced via 60 ms `schedule`. Fine.
- **MED-9.** Pomodoro cycles desync mid-session (Phase 1 M5).
- **MED-10.** `formatPx` `Math.round(value*100)/100` runs 4× per widget × 5 widgets × 3 boot passes = 60 calls. Negligible.
- **MED-11.** `vite.config.ts` has no manual chunking — Rollup auto-split is fine. Consider `build.target: 'es2022'` for ~5-10% size win.

### Low (9)

- LOW-1. BroadcastChannel re-instantiation race in `notify()`/`ensureBroadcastListener()` — production single-context fine.
- LOW-2. `setSecondsVisible` has reentry guard. ✓
- LOW-3. Inline `style.cursor` in quotes-widget.
- LOW-4. Tasks-widget rebuilds full list on `update()` — bounded by 60-item cap.
- LOW-5. `hexToRgb` recomputed 5× per `applySettingsToDocument` (~5 µs total).
- LOW-6. Pinned-tabs options-page input debounced 60 ms. Fine.
- LOW-7. Module-level `cachedSettings` (`storage.ts:9`) — page-lifecycle bound.
- LOW-8. `compressImage` allocates fresh canvas per attempt → GC pressure. Reuse.
- LOW-9. `WIDGET_IDS` iterated 6+ times during layout work. Bounded.

### Boot-time profile (newtab cold open)

1. HTML parse + JS parse (44 KB + 20 KB shared) — ~5-15 ms
2. `new ClockApp(container)` — ~0.5 ms
3. `buildLayout()` allocates ~150-200 DOM nodes (24 cells × 6 digits = 144 cells + ~30 framework + ~25 widget skeletons) — ~5-10 ms
4. **PASS 1** (`hydrateFromCache` → `onSettingsChanged`):
   - 3 diffs (~50 µs)
   - `loadWidgetLayout`+`ensureLayoutEntries` (forced layout from `offsetWidth` ×5) — 2-5 ms
   - `applySettingsToDocument` 44 var writes + invalidate — 3-8 ms
   - `updatePinnedTabs` (N=12) — 2-5 ms
   - `updateWidgets` (5 × `update()` + `applyWidgetLayout`) — 3-8 ms
   - `render(true)` initial paint (144 cells × 2 hands = 300 style writes) — 5-10 ms
   - Total PASS 1: ~15-40 ms
5. **First paint** can occur here at ~25-55 ms post-script-execute
6. **PASS 2** (`subscribeToSettings` immediate-fire) — diffs return mostly false but `updateWidgets`+`render(true)` always run — ~5-10 ms
7. Microtask: `loadSettings()` resolves (~5-30 ms chrome.storage) → **PASS 3** — if sync != cache, full 15-40 ms again **after first paint** → visible flicker

**TTFP estimate: 25-55 ms healthy device, up to 100 ms slow hardware.**

### Memory leaks confirmed

1. `chrome.storage.onChanged` listener never disposed in prod (`storage.ts:144-160`) — page-lifecycle bound, HMR risk.
2. `BroadcastChannel('tabula:settings')` never closed in prod.
3. Notes widget pending `setTimeout` debounce fires after `clock-app.stop()` skips destroy (Phase 1 H7).
4. Quotes widget in-flight `AbortController` not aborted (Phase 1 H7) — same skip.
5. Weather widget properly destroyed by `stop()`. ✓
6. Tasks widget no-op destroy fine (listeners die with elements). ✓

### Bundle / network

- newtab.js 44 KB, options.js 20 KB, storage.js 20 KB (shared, auto-extracted), newtab.css 20 KB, options.css 19 KB
- No wildcard imports. Tests excluded. No source maps. ✓
- **Google Fonts (Material Symbols Outlined ~150 KB) render-blocking external stylesheet** — biggest cold-boot net cost. Self-host + subset to actual icons used (settings/search/add/close/delete ≈ <20 icons) → drop ~150 KB.
- Missing preconnects: `www.google.com`, `api.weatherapi.com`, `quoteslate.vercel.app` (saves 100-300 ms per first request).
- `build.target: ['chrome100','firefox100']` would drop legacy transpilation ~5-10%.

---

## Critical Issues for Phase 3 Context

These Phase 2 findings affect Phase 3 (testing + documentation):

**Testing gaps revealed:**
- No test asserts cold-boot fires `onSettingsChanged` exactly once (CRIT-1) — needs spy/mock test.
- No test for `compressImage` yielding to main thread (CRIT-2).
- No test for storage quota-exceeded error path (H-SEC-3) — `runtime.lastError` simulation missing.
- No test that CSS url() sink rejects non-https URLs (C-SEC-2) — would catch regression on Vite-inlined env var changes.
- No test that pinned-tab href rejects javascript: at sanitizer (C-SEC-3).
- No security tests at all for sanitize functions — `defaults.ts:sanitize*` need fuzz cases for poisoned input.
- No tests for ticker drift correction (HIGH-1).
- No tests for memory leak on `stop()` w/o destroy (HIGH-5, Phase 1 H7).
- No tests for multi-tab broadcast loop suppression (`storage.ts:172-179`).
- Pomodoro test? Weather widget test? — verify in Phase 3.

**Documentation gaps revealed:**
- No privacy policy file evident — 7 endpoints leak data w/o disclosure.
- No CSP documentation in manifest.
- No README section listing `VITE_WEATHER_API_KEY` exposure trade-off or proxy path.
- No threat model document.
- No architecture decision records (ADRs) for: chrome.storage.sync split between sync/local for imageData; BroadcastChannel choice over service worker; per-widget cache keys.
- No CHANGELOG entries for breaking changes (only `RELEASE_NOTES_v1.2.1.md` exists).
- Inline comments on subtle algorithms (drag anchor math, image compression iteration heuristic) absent.

---

## Combined Phase 1+2 counts so far

- Critical: **13** (6 from Phase 1, 7 from Phase 2)
- High: **34** (18 + 16)
- Medium: **44** (23 + 21)
- Low: **39** (22 + 17)
- **Total: 130 findings**
