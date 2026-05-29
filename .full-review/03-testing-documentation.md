# Phase 3: Testing & Documentation Review

Read Phase 1 + Phase 2 outputs first (`01-quality-architecture.md`, `02-security-performance.md`). This phase verifies whether test + docs guard the critical issues those phases surfaced.

---

## Test Coverage Findings (Phase 3A) — 36 total

### Existing tests inventoried (14 files, 86 `it`-blocks)

| Test file | `it` | Subject | Notable gaps |
|---|--:|---|---|
| `app/clock-app.test.ts` | 3 | anchor derivation | Boot triple-fire, diff fns, `stop()` disposal — ALL of 1206 LOC unguarded at ~5% surface |
| `clock/clock-display.test.ts` | 4 | clock digit render | No 00:00 boundary, no re-render idempotence |
| `clock/digit-map.test.ts` | 3 | digit lookup | Only spot-checks 0/1 — not all 10 digits |
| `core/dom.test.ts` | 11 | createElement+debounce | Solid |
| `core/ticker.test.ts` | 1 | aligned ticker | **No drift correction test (HIGH-1)** |
| `core/time.test.ts` | 3 | formatTime | No noon/1PM/invalid |
| `settings/defaults.test.ts` | 12 | mergeWithDefaults | **No fuzz cases for poisoned input — C-SEC-2/3 unguarded** |
| `settings/storage.test.ts` | 3 | save/load/update | `beforeEach` deletes `chrome` → only localStorage path tested |
| `settings/storage.broadcast.test.ts` | 1 | BroadcastChannel sync | No envelope versioning, no malformed-message rejection |
| `settings/storage.priority.test.ts` | 1 | sync vs local | **No `runtime.lastError` / quota error path (H-SEC-3)** |
| `settings/theme.test.ts` | 2 | resolveTheme | OK |
| `widgets/notes-widget.test.ts` | 10 | notes widget | No debounce assertion (HIGH-8) |
| `widgets/quotes-widget.test.ts` | 7 | (does NOT import widget) | **Tests only reimplemented utility logic — zero behavioral coverage** |
| `widgets/tasks-widget.test.ts` | 15 | tasks widget | Solid; missing destroy smoke |

### Untested source modules

- `widgets/pomodoro-widget.ts` (517 LOC) — **ZERO tests**
- `widgets/weather-widget.ts` (310 LOC) — **ZERO tests**
- `pages/options/main.ts` (892 LOC) — **ZERO tests**
- `pages/options/pinned-tabs.ts` (400 LOC) — **ZERO tests**
- `settings/apply.ts` (167 LOC) — only tested indirectly
- `settings/presets.ts` (162 LOC) — only tested indirectly
- `clock/digit.ts` (73 LOC) — only via integration

### Critical (7) — gaps mapping to Phase 1/2 critical findings

**C1. Boot does NOT verify `onSettingsChanged` fires once (Phase 2 CRIT-1)**
- No test that spies on `onSettingsChanged` after `start()`. Triple-fire untested.
- Sample test:
```ts
// src/app/clock-app.boot.test.ts
it("fires onSettingsChanged exactly once during cold boot", async () => {
  const app = new ClockApp(container);
  const spy = vi.spyOn(app as any, "onSettingsChanged");
  await (app as any).start();
  await new Promise(r => setTimeout(r, 0));
  await new Promise(r => setTimeout(r, 0));
  expect(spy).toHaveBeenCalledTimes(1);  // currently 3
});
```

**C2. `compressImage` does not yield to main thread (Phase 2 CRIT-2)**
- `pages/options/main.ts` entirely untested. Sample test after extracting `compressImage`:
```ts
it("calls setTimeout(0) between scale steps", async () => {
  const spy = vi.spyOn(globalThis, "setTimeout");
  await compressImage(bigFile, 4*1024*1024);
  const yieldCalls = spy.mock.calls.filter(([, ms]) => ms === 0);
  expect(yieldCalls.length).toBeGreaterThan(0);
});
it("rejects files >20MB before readAsDataURL", async () => {
  await expect(compressImage(huge, 4*1024*1024)).rejects.toThrow(/too large/i);
});
```

**C3. `chrome.storage.sync` quota error path untested (Phase 2 H-SEC-3)**
- Inject `chrome.runtime.lastError = "QUOTA_BYTES_PER_ITEM"` and verify graceful fallback + future failure signal:
```ts
(globalThis as any).chrome = {
  storage: {
    sync: { set: vi.fn().mockRejectedValue(new Error("QUOTA_BYTES_PER_ITEM")) },
    local: { set: localSet, get: vi.fn().mockResolvedValue({}) },
    onChanged: { addListener: vi.fn() },
  },
  runtime: { lastError: { message: "QUOTA_BYTES_PER_ITEM exceeded" } },
};
await saveSettings(DEFAULT_SETTINGS);
expect(localSet).toHaveBeenCalled();
```

**C4. CSS `url()` sink accepts non-https `imageUrl` (Phase 2 C-SEC-2)**
- `defaults.test.ts` only tests `"notaurl"` → dropped. No fuzz for script-scheme, data:text, breakout chars:
```ts
const bad = ["javascript:alert(1)", "data:text/plain,abc", "x); background: red; --x: url(y", "http://attacker.com/", "file:///etc/passwd"];
it.each(bad)("rejects %s in imageUrl", (p) => {
  const result = mergeWithDefaults({ background: { type: "image", imageUrl: p, imageData: "" } });
  expect(result.background.imageUrl).toBe("");
});
```

**C5. Pinned-tab href accepts script-scheme (Phase 2 C-SEC-3)**
- No render-time validation test. Sample:
```ts
const bad = ["javascript:alert(1)", "data:text/plain,abc", "file:///etc/passwd", "chrome-extension://abc/page"];
it.each(bad)("rejects %s", (url) => {
  expect(mergeWithDefaults({ pinnedTabs: [{ id:"a", title:"x", url }] }).pinnedTabs).toHaveLength(0);
});
it("rejects non-https tab.icon", () => {
  const r = mergeWithDefaults({ pinnedTabs: [{ id:"a", title:"x", url:"https://ok", icon:"javascript:alert(1)" } as any] });
  expect(r.pinnedTabs[0]?.icon).toBeUndefined();
});
```

**C6. Quotes widget triple-fetch (Phase 2 CRIT-4) — no test imports the widget**
- Existing `quotes-widget.test.ts` reimplements util logic, never imports `createQuotesWidget`:
```ts
it("dedupes 3 rapid update() calls into 1 fetch", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(...);
  const widget = createQuotesWidget();
  widget.update({ enabled: true } as any);
  widget.update({ enabled: true } as any);
  widget.update({ enabled: true } as any);
  await new Promise(r => setTimeout(r, 0));
  expect(fetchSpy).toHaveBeenCalledTimes(1);
});
it("aborts in-flight fetch on destroy", async () => {
  /* track AbortSignal; widget.destroy(); expect signal.aborted true */
});
```

**C7. Pomodoro widget completely untested (Phase 2 CRIT-3)**
- 517 LOC, zero tests. Tick-storm regression guard absent.

### High (10)

- **H1.** Ticker drift correction (Phase 2 HIGH-1) — no recursive realign test.
- **H2.** `applySettingsToDocument` write-elision (Phase 2 HIGH-2) — no test that 2nd identical pass = 0 writes.
- **H3.** Diff fns (`hasAppearanceChanged`/`hasLayoutChanged`/`hasPinnedTabsChanged`) untested. Missing `clock.format`/`showSeconds`/`enabled` fields exposed only by tests.
- **H4.** Notes-widget debounce ≥2s (Phase 2 HIGH-8) — no timer test.
- **H5.** Pomodoro tick storm (Phase 2 CRIT-3) — fake-timer run 60× + assert ≤1 storage write.
- **H6.** Memory leak on `stop()` (Phase 1 H7, Phase 2 HIGH-6) — no test that each widget's `destroy()` runs + `chrome.storage.onChanged.removeListener` called + `BroadcastChannel.close()`.
- **H7.** BroadcastChannel envelope versioning (Phase 2 H-SEC-5) — no test rejects `null`/missing version.
- **H8.** Weather widget completely untested (310 LOC) — single-fetch on triple-update untested.
- **H9.** Storage callback-style `runtime.lastError` path — `storage.priority.test.ts` uses promise path only.
- **H10.** Anchor clamp boundaries (negative offset, offset > viewport) untested.

### Medium (11)

- M1. `presets.ts` (162 LOC) untested. No per-preset palette structural tests.
- M2. `apply.ts` (166 LOC) zero direct tests — coverage only via downstream effects.
- M3. `digit.ts` (73 LOC) untested directly.
- M4. `pages/options/main.ts` (892 LOC) untested entirely.
- M5. `pages/options/pinned-tabs.ts` (400 LOC) untested entirely.
- M6. `storage.test.ts` `beforeEach` deletes `chrome` → exercises localStorage-only path.
- M7. Tasks-widget: no XSS-safety assertion (script tag in `task.text`).
- M8. Tasks `onChange` idempotence on re-update with same items.
- M9. Clock-display: no test that re-render of same time skips DOM writes.
- M10. `customQuotes` schema field (Phase 2 M-SEC-6) never tested.
- M11. `clock-app.test.ts:73-89` mutates `window.innerWidth` w/o restore → leaks across suites.

### Low (8)

- L1. No property-based / fuzz harness for `mergeWithDefaults`.
- L2. No `console.warn` call-site tests — silent failures unobservable.
- L3. Tasks-widget ID generator uses microsecond gap — flake risk.
- L4. `vitest.config.ts globals: true` + explicit `from "vitest"` imports — redundant config.
- L5. No coverage gate; `@vitest/coverage-v8` installed but no threshold.
- L6. `bun-test.setup.ts` copies all jsdom `window` props onto globals — slow + pollutes.
- L7. No snapshot tests anywhere.
- L8. `vitest-shim.ts` aliases `mock as vi` — cross-runtime fragility.

### Flaky-test risk

1. `clock-app.test.ts` mutates `window.innerWidth` without `afterEach` reset.
2. `storage.broadcast.test.ts` uses `queueMicrotask` — racy without explicit flush.
3. `storage.priority.test.ts` calls `__resetStorageModuleForTests` AFTER first import → order-dependent.
4. `tasks-widget.test.ts:generateTaskId` — fast double-submit relies on Math.random for entropy.
5. `dom.test.ts` debounce uses Bun's `jest.useFakeTimers()` re-exported as `vi` — differs under Vitest.
6. 8 of 14 test files have no `afterEach`.
7. `storage.test.ts` `beforeEach` deletes `chrome` but listeners from prior tests survive in module state.

### Pyramid

- Unit ~80 (~93%) / Integration ~6 (~7%) / E2E 0. No headless-Chrome smoke. No `dist/` load test. `web-ext lint` static-only.

### CI integration

- `.github/workflows/ci.yml`: `bun install` → `type-check` → `bun test` → `bun run build` → `web-ext lint`. Gates merges. ✓
- `.github/workflows/release.yml`: same gate on tag/release. ✓
- **Missing**:
  - No coverage threshold (`@vitest/coverage-v8` installed, never run).
  - No `test:vitest` invocation — dual-runner setup, only Bun side gates CI.
  - No matrix (Node version, OS); single ubuntu-latest.
  - No timeout on test step.
  - No `dependency-review-action`.
  - No SAST (CodeQL).
  - No bundle-size budget check.
  - Test artifacts (junit, coverage HTML) not uploaded.

### Top 10 missing tests (priority)

| # | Sev | File:scenario | Guards |
|---|---|---|---|
| 1 | Crit | `clock-app.boot.test.ts`: cold boot | CRIT-1 |
| 2 | Crit | `defaults.security.test.ts`: imageUrl allowlist | C-SEC-2 |
| 3 | Crit | `pinned-tabs.security.test.ts`: href allowlist + icon protocol | C-SEC-3, H-SEC-1 |
| 4 | Crit | `quotes-widget.fetch.test.ts`: dedup + abort | CRIT-4, P1 H7 |
| 5 | Crit | `storage.quota.test.ts`: sync quota → local fallback | H-SEC-3 |
| 6 | Crit | `options/compress.test.ts`: yields + size guard | CRIT-2, M-SEC-9 |
| 7 | High | `pomodoro-widget.test.ts` (NEW): tick storage frequency | CRIT-3 |
| 8 | High | `weather-widget.test.ts` (NEW): single fetch + abort on destroy | HIGH-7, P1 H7 |
| 9 | High | `ticker.drift.test.ts`: recursive realign | HIGH-1 |
| 10 | High | `clock-app.lifecycle.test.ts`: stop() disposes all | HIGH-6, P1 H7 |

---

## Documentation Findings (Phase 3B) — 26 total

### Inventory (14 doc files)

| Path | Purpose | Notes |
|---|---|---|
| `README.md` (4.7 KB) | Top-level | Missing: env vars, troubleshooting, privacy, screenshots |
| `RELEASE_NOTES_v1.2.1.md` | Single-version notes | No accumulating CHANGELOG |
| `LICENSE` | MIT | ✓ |
| `manifest.json:5 description` | Tagline only | No functional summary for store reviewers |
| `docs/CI_SECRETS.md` (1.0 KB) | CI secrets | Duplicates RELEASE_GUIDE |
| `docs/STORE_LISTING.md` (1.6 KB) | Store copy | **Privacy claim contradicts code** |
| `.github/CONTRIBUTING.md` (1.5 KB) | Dev setup | Brief; no test-writing guide, no DCO |
| `.github/RELEASE_GUIDE.md` (4.8 KB) | Release pipeline | Good |
| `.github/SECURITY.md` (493 B) | Vuln disclosure | Minimal; no PGP, no scope, no safe harbor |
| `.github/FUNDING.yml` | Sponsor | ✓ |
| `.github/ISSUE_TEMPLATE/*` | Issue templates | ✓ |
| `.github/workflows/*.yml` | CI | Zero inline comments |

**Absent:** `CHANGELOG.md`, root `SECURITY.md`, `PRIVACY.md`, `THREAT_MODEL.md`, `ARCHITECTURE.md`, `docs/adr/`, JSDoc generation config, TypeDoc.

**JSDoc presence in src/:** 2 of 21 non-test files have any `/**` block.
- `core/dom.ts:18-22` — debounce
- `pages/options/main.ts:130-133` — compressImage (4 lines; no rationale for thresholds)

Zero ADRs. Zero field-level comments on `schema.ts` (167-line settings contract). Zero comments on `apply.ts:50-166` (44-call CSS-var wall), `defaults.ts:519-581` (`mergeWithDefaults` 62-line preset orchestrator), `clock-app.ts:519-666` (drag anchor math), `digit-map.ts:5-14` ROTATIONS table.

### Critical (4) — store listing / user trust

**C-DOC-1. No `PRIVACY.md`**
- 7 endpoints transmit data; no disclosure. AMO + CWS both require hosted privacy-policy URL.
- `docs/STORE_LISTING.md:25` says "Tabula does not collect or transmit personal data" — provably false (weatherapi, google s2/favicons, google fonts, quoteslate, user-supplied hosts, chrome.storage.sync).
- `manifest.json:25-28` declares `data_collection_permissions.required: ["none"]` to AMO — same contradiction.
- Fix: create root `PRIVACY.md` with TL;DR + local-storage list + outbound-request table + sync disclosure + third-party-key note + contact.

**C-DOC-2. `docs/STORE_LISTING.md` privacy claim is factually false**
- Line 25 ("No data collection") + line 182 ("Data collected: None"). Submitting to AMO/CWS = policy violation.
- Fix: replace with accurate per-vendor disclosure table referencing PRIVACY.md.

**C-DOC-3. `manifest.json:5` description is tagline-only**
- `"Tabula – Your space, no noise."` = zero functional context. CWS + AMO rubrics penalize.
- Fix (≤132 chars):
```json
"description": "Minimal new tab: clock, search, pinned tabs, weather, pomodoro, tasks, notes, quotes. No analytics. Open source."
```

**C-DOC-4. No CSP declaration nor CSP-posture doc**
- `manifest.json` has no `content_security_policy.extension_pages` (Phase 2 H-SEC-6). MV3 default applies; Google Fonts CSS may be silently blocked.
- Fix: bundle fonts locally (drops Google Fonts + privacy ping) and document via ADR; OR declare explicit CSP + document trade-off in README "Security posture".

### High (6)

**H-DOC-1. No `CHANGELOG.md`**
- Only `RELEASE_NOTES_v1.2.1.md`. v1.0/1.1/1.2.0 have no historical record in-tree.
- Fix: root `CHANGELOG.md` (Keep a Changelog format). Migrate v1.2.1 notes under header. Update `RELEASE_GUIDE.md` to prepend per release.

**H-DOC-2. README missing `VITE_WEATHER_API_KEY` env-var section** (Phase 2 C-SEC-1 corequisite)
- Fork breaks silently without diagnostic. No explanation of Vite inlining + key-exposure trade-off.
- Fix: add `### Environment variables` section between `Development` and `Load Extension` documenting the var + the security note + mitigation (referer + quota + proxy roadmap).

**H-DOC-3. No troubleshooting section**
- Common failures undocumented: pinned-tab icons disappear (M-SEC-2 onerror writeback), "Weather unavailable" (missing key), notes/tasks not syncing (quota), pomodoro out-of-sync (M5), lint:firefox failing (need build first), hot-reload not picking up settings (need extension reload).
- Fix: append `## Troubleshooting` to README — symptom → cause → fix table.

**H-DOC-4. No ADRs for non-obvious choices**
- chrome.storage sync/local split (imageData local-only); BroadcastChannel over service worker; per-widget cache keys + 3-pass settings cascade; monolithic ClockApp; hand-rolled diff fns; embedded WeatherAPI key (accepted trade-off); single ~5-10 KB blob at one sync key.
- Fix: `docs/adr/` directory + 6 ADRs (Nygard template):
  - 0001-record-architecture-decisions
  - 0002-storage-sync-local-split
  - 0003-broadcastchannel-over-sw
  - 0004-embedded-weather-api-key
  - 0005-monolithic-clockapp (or rebut + plan split)
  - 0006-settings-single-key-storage

**H-DOC-5. No TSDoc on `Settings` schema**
- `schema.ts:1-167` is the contract every module depends on. Zero field-level comments. Cannot tell sync-vs-local, range/length constraints, deprecated fields (`customQuotes`), CSP/XSS implications (`background.imageUrl`).
- Fix: TSDoc every field — example for `imageData`:
```ts
/** Base64 data URL. Never written to chrome.storage.sync (8 KiB per-item).
 *  Persisted to chrome.storage.local only — see ADR-0002.
 *  Format: data:image/(png|jpeg|webp);base64,... */
imageData?: string;
```

**H-DOC-6. No threat model**
- 27 Phase 2 security findings have no enumerated trust boundaries / attacker capabilities / sanitization invariants.
- Fix: `docs/THREAT_MODEL.md` — Assets / Trust boundaries / Threats table (T1-T6 mapping to OPEN/RESOLVED) / Out of scope / Reporting.

### Medium (8)

- **M-DOC-1.** Inline algorithm comments missing on 5 hotspots: `compressImage` (magic thresholds), drag anchor trio in `clock-app.ts:519-666`, `digit-map.ts:5-14` ROTATIONS table, `mergeWithDefaults` 4-branch decision tree, `applySettingsToDocument` grouping comments.
- **M-DOC-2.** README "Project Structure" omits `app/`, `pages/`, `scripts/`, `bun-test.setup.ts`, `vitest-shim.ts`. Extend tree.
- **M-DOC-3.** CI workflows have zero inline comments — `release.yml:72` swallows exit 124 silently; line 36-37 inlines API key with no security note.
- **M-DOC-4.** `CONTRIBUTING.md` missing test-writing + commit-signoff + sensitive-change guidance + PR template.
- **M-DOC-5.** `SECURITY.md` lacks scope + PGP + safe-harbor.
- **M-DOC-6.** `docs/CI_SECRETS.md` duplicates `RELEASE_GUIDE.md` — will drift. Delete or merge.
- **M-DOC-7.** `docs/STORE_LISTING.md:16` widget list missing **notes** + **quotes**.
- **M-DOC-8.** README:41 references stale "ZenQuotes API" — v1.2.1 switched to QuoteSlate.

### Low (8)

- L-DOC-1. `tsconfig.json` `$src/*` paths undocumented.
- L-DOC-2. No `.editorconfig` / Prettier / ESLint.
- L-DOC-3. No `CODE_OF_CONDUCT.md`.
- L-DOC-4. `.amo-metadata.json` schema undocumented.
- L-DOC-5. README CI badge points to `release.yml` — should be `ci.yml`.
- L-DOC-6. No `SHA256SUMS` published with releases.
- L-DOC-7. No accessibility statement.
- L-DOC-8. `railway.toml` (100 B) at root is unexplained.

### Recommended new docs (priority order)

1. `PRIVACY.md` (root) — addresses C-DOC-1.
2. `CHANGELOG.md` (root) — H-DOC-1.
3. `docs/THREAT_MODEL.md` — H-DOC-6.
4. `docs/adr/0001-0006-*.md` — H-DOC-4.
5. `docs/ARCHITECTURE.md` — boot sequence + render pipeline + IPC.
6. Inline TSDoc on `schema.ts` — H-DOC-5.
7. `.github/pull_request_template.md` — M-DOC-4.
8. `CODE_OF_CONDUCT.md` (root) — L-DOC-3.
9. Expanded `SECURITY.md` — M-DOC-5.
10. README rewrite with env vars + troubleshooting + fixed widget list + project tree — H-DOC-2, H-DOC-3, M-DOC-2, M-DOC-8.
11. Inline comments on 5 algorithmic hotspots — M-DOC-1.
12. CI workflow comments — M-DOC-3.
13. Delete `docs/CI_SECRETS.md` or fold into RELEASE_GUIDE — M-DOC-6.
14. Document `.amo-metadata.json` schema — L-DOC-4.

---

## Combined counts (Phases 1+2+3)

- Critical: **24** (13 + 11)
- High: **50** (34 + 16)
- Medium: **63** (44 + 19)
- Low: **55** (39 + 16)
- **Total so far: 192 findings**
