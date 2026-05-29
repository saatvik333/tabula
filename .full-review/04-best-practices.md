# Phase 4: Best Practices & Standards

Reviewed both framework/language (4A) and CI/CD/DevOps (4B). Cross-references all prior phases.

---

## Framework & Language Best Practices (Phase 4A) — 30 findings

### Verified counts across 18 non-test src files (7160 LOC)

- `any` lines: **13** (concentrated in `storage.ts`)
- `as` casts: 48 — only **5 are `as any`** (rest legitimate DOM/validator narrowing)
- `import type` adoption: high (>20 sites)
- `export default`: **0** (named-only — consistent)
- Wildcard imports (`import * as`): **0**
- Relative cross-dir imports: **0** (all use `$src` alias)
- `console.warn/error`: **27** call sites
- `satisfies` operator: **0**
- `Object.freeze`: **0**
- `const enum`: 0 (uses string unions — good)

### TypeScript

`tsconfig.json` posture is excellent: `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `noImplicitOverride` + `noPropertyAccessFromIndexSignature` + `useDefineForClassFields` + `noFallthroughCasesInSwitch`. Target ES2022, module ESNext, moduleResolution bundler, isolatedModules. The codebase unsoundness is from one module (`storage.ts`) deliberately bypassing strict via `any` shims.

### Module conventions

- No default exports. Named-only. ✓
- `import type` used widely; recommend adding `verbatimModuleSyntax: true` to enforce.
- No wildcard imports. ✓
- `$src` alias used everywhere; zero `../` paths in non-test src. ✓
- No circular deps (Phase 1B confirmed).

### MV3 / Web Extension

- `manifest_version: 3` ✓
- No service worker (correct for a page-only extension) — document via ADR.
- `host_permissions` understates surface (Phase 2 H-SEC-2).
- `chrome.action` not declared — correct (newtab override is the surface).
- `chrome.storage.session` not used — fine without SW.
- `web_accessible_resources` absent ✓.
- `notifications` permission declared but code uses Web Notifications API (Phase 2 M-SEC-4). Pick one.
- Cross-browser shim: `(browser as any)?.runtime` ×5 sites defeat the `declare const browser` type. Single typed accessor would fix.
- `webextension-polyfill` not used — fine for this small API surface.
- Firefox `browser_specific_settings` declared ✓ (`strict_min_version: "115.0"`).
- No CSP declared (Phase 2 H-SEC-6).

### Vite + Bun

- `vite.config.ts` (31 lines): multi-entry HTML inputs ✓, `base: "./"` ✓, `build.sourcemap: false` ✓, no plugins.
- **`build.target` missing** — default ES2020 transpile despite tsconfig ES2022. Add `target: ["chrome100","firefox115"]` (~5-10% size).
- HMR survives module-level singletons in `storage.ts` — accumulating listeners across reloads (Phase 2 HIGH-6, LOW-1).
- `import.meta.env["VITE_WEATHER_API_KEY"]` inlined (Phase 2 C-SEC-1).
- Bun: `bunfig.toml` minimal/correct (`preload`, alias `vitest`→shim, alias `$src`→`./src`). `bun.lock` committed.
- `scripts/*.mjs` use Node-compat APIs (not Bun-only).
- **Dual Bun-test + Vitest setup half-wired**: Bun gates CI, Vitest never runs in CI. Either drop Vitest or run both.

### Critical (2)

**CRIT-BP-1. Storage module typed `any` defeats project `strict: true`**
- `storage.ts:18-21,39-99,219,385`. 4 module-level `let` vars typed `any`; helpers `invokeGet/Set/Remove(store: any, ...)`; `__resetStorageModuleForTests(api?: any)`; `combined.background = {} as any`.
- Fix: type via `@types/chrome` (already installed):
```ts
type ExtensionApi = typeof chrome;
type StorageArea = chrome.storage.StorageArea;
let extensionAPI: ExtensionApi | null = null;
let syncStorage: StorageArea | null = null;
const invokeGet = async <T>(store: StorageArea | null, key: string): Promise<T | undefined> => { /* ... */ };
```
Drops 13 `any` lines and removes the only place where `strict` is bypassed.

**CRIT-BP-2. `VITE_WEATHER_API_KEY` inlined into shipped bundle**
- `weather-widget.ts:29`. Verified inlined in `dist/assets/newtab.js`. Phase 2 C-SEC-1 covers attack surface; DevOps angle in 4B C-CICD-3.
- Fix: proxy via your own Worker/Function, OR switch to `open-meteo.com` (no key).

### High (6)

**HIGH-BP-1. No CSP declared; Google Fonts as remote CSS**
- `manifest.json` no `content_security_policy.extension_pages`; `pages/{newtab,options}/index.html` `<link href="https://fonts.googleapis.com/...">`.
- Fix: bundle subsetted Material Symbols (~20 icons) locally — drops ~150 KB cold fetch + privacy ping. If kept remote, declare explicit CSP.

**HIGH-BP-2. `build.target` left at Vite default (ES2020-ish)**
- `vite.config.ts:6` has no `target`. tsconfig is ES2022; manifest pins Firefox 115.
- Fix: `build: { target: ["chrome100","firefox115"], ... }`. ~5-10% size win.

**HIGH-BP-3. `chrome`/`browser` global typed `any` ×5**
- `clock-app.ts:1146-1147`, `storage.ts:27-28,385`.
- Fix: single typed accessor in `core/extension-api.ts`:
```ts
type ExtensionApi = typeof chrome;
export const getExtensionApi = (): ExtensionApi | null => {
  const g = globalThis as { chrome?: ExtensionApi; browser?: ExtensionApi };
  return g.browser ?? g.chrome ?? null;
};
```
Removes all 5 `as any` sites.

**HIGH-BP-4. Dual mock runtime (Bun+Vitest) only half-gated**
- `package.json:11-13`; CI runs only `bun test`. `@vitest/coverage-v8` installed, never invoked.
- Fix: drop Vitest devDeps + `vitest-shim.ts` (Bun coverage will mature) OR add `vitest --run --coverage` to CI behind a threshold.

**HIGH-BP-5. Chrome storage write-path silently swallows quota errors**
- `storage.ts:199-209,328-343`. Notes content unbounded (`defaults.ts:360`); paste >8 KiB → silent sync failure → cross-device data loss.
- Fix: bubble quota failures as typed Result; UI banner "Sync paused — data exceeds device sync limit". Cap notes at 32 KiB in `sanitizeNotesContent`.

**HIGH-BP-6. `bun-types: "latest"` unpinned**
- `package.json:37` — `bun install` resolves to whatever's published latest; lockfile pins but force-installs diverge.
- Fix: pin `"bun-types": "^1.1.x"`.

### Medium (10)

- **MED-BP-1.** `BackgroundType = "image"` single-member union → dead variability. Replace with discriminated union `{ kind: "color" | "image-url" | "image-data" }`; `formatBackgroundImage` becomes exhaustive.
- **MED-BP-2.** No `satisfies` for static tables (`DEFAULT_SETTINGS`, `PRESETS`, `SEARCH_ENGINES`, `MODE_LABELS`). Use `... as const satisfies T` for narrower types + drift detection.
- **MED-BP-3.** `PartialSettings` is hand-rolled DeepPartial → replace with utility type (Phase 1 M5-arch).
- **MED-BP-4.** `console.warn` ×27 with no scrubbing in production. `src/core/logger.ts` w/ `createLogger("storage")` + Vite `define` strip.
- **MED-BP-5.** `JSON.parse(JSON.stringify(...))` `structuredClone` fallback is dead code (Chrome 98+, Firefox 94+ support native). Drop ternary.
- **MED-BP-6.** `crypto.randomUUID` feature-detect is dead (target Chrome 100+, FF 115+). 3 different ID generators with 3 different fallbacks; centralize in `core/id.ts`.
- **MED-BP-7.** `Object.freeze(DEFAULT_SETTINGS)` at module init would catch test mutations.
- **MED-BP-8.** `Object.prototype.hasOwnProperty.call` (`defaults.ts:522`) → `Object.hasOwn` (ES2022).
- **MED-BP-9.** `package.json.engines` missing. Add `{ "node": ">=20", "bun": ">=1.1.0" }`.
- **MED-BP-10.** Vite `define` not used for `__DEV__` strip. Add `define: { __DEBUG__: !process.env.RELEASE_BUILD }` to gate warns.

### Low (12)

- LOW-BP-1. `BackgroundType` redundant type alias (see MED-BP-1).
- LOW-BP-2. `verbatimModuleSyntax` not enabled (codebase follows convention, free win).
- LOW-BP-3. Template-literal types for storage keys / IDs (`type StorageKey = \`tabula:${string}\``).
- LOW-BP-4. `as const satisfies` not used for `WIDGET_IDS` / `KNOWN_WIDGET_IDS`.
- LOW-BP-5. `archiver` is correct (Bun has no native zip writer).
- LOW-BP-6. `web-ext: ^7.11.0` is one major behind 8.x.
- LOW-BP-7. `vitest.config.ts globals: true` + explicit `from "vitest"` — redundant (Phase 3 L4).
- LOW-BP-8. `getElement<T>` (options/main.ts) duplicates `createElement<T>` constraint — share.
- LOW-BP-9. `replaceChildren()` vs `innerHTML = ""` inconsistency.
- LOW-BP-10. `chrome.notifications` permission declared, never used; Web API used instead.
- LOW-BP-11. `tsconfig.json paths` `$src/*` undocumented.
- LOW-BP-12. `tsconfig.types` overlap: `vitest/globals` + explicit `from "vitest"` — pick one mode.

---

## CI/CD & DevOps Findings (Phase 4B) — 35 findings

### Pipeline inventory

**`.github/workflows/ci.yml`** (554 B): triggers push/PR to main. Sequence: checkout → setup-bun@v2 (`bun-version: latest`) → `bun install` (no `--frozen-lockfile`) → `type-check` → `bun test` → `bun run build` (no API key → builds different bundle than ships) → `bun run lint:firefox`.

**`.github/workflows/release.yml`** (3.0 KB): triggers `release: published` AND `push: tags: ["v*"]` (double-fires). Permissions `contents: write`. Build w/ `VITE_WEATHER_API_KEY` injected from secrets + `RELEASE_BUILD=1`. Sign Firefox via `web-ext sign`. Chrome publish commented out.

**Not gated by CI**: lint/format (no Prettier/ESLint/Biome), coverage threshold, Vitest runner, bundle size, dep review, SAST, license compliance.

No `timeout-minutes` → 6h GHA default hang risk.

### Build scripts

- `scripts/build.mjs` (55 lines): viteBuild + HTML output relocation (Vite emits `dist/src/pages/.../index.html`; script moves to flat `dist/newtab.html` + `dist/options.html`) + manifest post-processing (patches AMO `data_collection` block when `CI || RELEASE_BUILD`) + icon copy.
- `scripts/clean.mjs` (8 lines): removes only `dist/`, NOT `web-ext-artifacts/`, `coverage/`, or root `tabula-*.zip`/`tabula.xpi`.
- `scripts/package.mjs` (46 lines): zips `dist/` twice — once as `tabula-${v}-chrome.zip`, once as `tabula-${v}-firefox.zip`. **Bit-identical**. Wasted compute.
- `scripts/version.mjs` (9 lines): reads version from `manifest.json`. `package.json:3` is manual-synced.

### Release process

Manual SemVer. Edit `manifest.json` → commit → push → create GH Release. No `bumpp`/`release-please`/`semantic-release`. No automated CHANGELOG. No rollback procedure. No SLSA L1+ provenance. No Sigstore signing.

### Secrets

| Secret | Used by | Notes |
|---|---|---|
| `VITE_WEATHER_API_KEY` | release.yml:36 | **Not actually secret** — inlined into bundle. Verified key `c921752e6e...` present in `.env` + GH secrets + every shipped bundle. |
| `AMO_JWT_ISSUER`+`SECRET` | release.yml:68-71 | Actual secrets. Aliased redundantly (also `WEB_EXT_API_KEY`/`_SECRET`). |
| `CHROME_*` | release.yml:88-100 commented | Dormant. |

`.env` gitignored ✓. `git ls-files .env` returns nothing.

### Supply chain

- `bun.lock` committed.
- `bun install` w/o `--frozen-lockfile` in CI.
- Zero runtime deps in shipped extension ✓.
- **No `bun pm audit`/`npm audit`/Snyk/OSV-scanner step in CI.**
- **No `actions/dependency-review-action` on PRs.**
- **No CodeQL.**
- **No SBOM**, no provenance attestation.
- All actions pinned to **tag, not SHA** — third-party (`oven-sh/setup-bun@v2`, `softprops/action-gh-release@v2`) → tag-hijack risk.

### Build artifacts

Verified via `git ls-files`: `dist/`, `web-ext-artifacts/`, `coverage/`, `tabula.xpi`, `tabula-*.zip`, `.env` all NOT tracked ✓. `railway.toml` tracked but **dead** (references `bun run start` which doesn't exist).

### Critical (3)

**C-CICD-1. Action pinning to tag (not SHA) — supply-chain hijack risk**
- `release.yml:21,59,84` uses `oven-sh/setup-bun@v2` + `softprops/action-gh-release@v2` by tag. Tag-hijack on either repo injects code into next signed AMO release (step 12 holds AMO creds).
- Fix: pin to commit SHA + tag-comment:
```yaml
uses: oven-sh/setup-bun@4bc047ad259df6fc24a6c9e0f6d3b3b1da7e0c50  # v2.0.2
uses: softprops/action-gh-release@de2c0eb89ae2a093876385947365aca7b0e5f844  # v2.0.5
```
Add Dependabot `package-ecosystem: github-actions`.

**C-CICD-2. `release.yml:72 timeout 2m … || [ $? -eq 124 ]` silently masks AMO publish failure**
- Both exit 0 (success) and exit 124 (timeout-killed) treated identical. Genuine `web-ext sign` failure → "step passed" with no published version → release tag exists + GH assets attached, AMO never received upload. Detection delay = days.
- Fix:
```yaml
- name: Publish to Firefox AMO
  timeout-minutes: 10
  run: bun run publish:firefox
```
Add post-publish verification step querying AMO API for the version.

**C-CICD-3. `VITE_WEATHER_API_KEY` "secret" misclassified — stored in GH secrets + shipped in bundle + plaintext in local `.env`**
- Creates a **false trust signal**: contributors might assume "secret in CI → safe".
- Fix: move from `secrets.*` to `vars.*` in workflow (GHA distinguishes). Document loudly in `RELEASE_GUIDE.md` that the var is public-bundle. Cap key on weatherapi.com via referer restriction + monthly quota.

### High (8)

- **H-CICD-1.** No `dependency-review-action` on PRs. Free, single-line. CVE in incoming dep bump merges silently.
- **H-CICD-2.** No CodeQL SAST. Free for public repos. Would have caught Phase 2 C-SEC-2 (CSS `url()` interpolation).
- **H-CICD-3.** Vitest path uncovered in CI. Pick one runner: drop Vitest+coverage-v8 OR add `bun run test:coverage` to CI w/ threshold + artifact upload.
- **H-CICD-4.** No `timeout-minutes` on any job. Hung jsdom infinite-loop = 6 h runner block. Add `jobs.test.timeout-minutes: 15`.
- **H-CICD-5.** `release.yml` double-fires (`release: published` AND `push: tags: ["v*"]`). Two parallel runs race for same AMO version slot. Fix: `concurrency: { group: release-${{ github.ref }}, cancel-in-progress: false }`. Or simplify trigger to release-only.
- **H-CICD-6.** No SHA256SUMS / sig for GH-release zips. Users side-loading Chrome zip have no integrity check. Add `sha256sum tabula-*-{chrome,firefox}.zip > SHA256SUMS` + attach.
- **H-CICD-7.** No build provenance attestation. `actions/attest-build-provenance@v2` is one step.
- **H-CICD-8.** No `.github/dependabot.yml`. devDeps drift; GHA actions never get SHA-pin updates. Add config for `npm` + `github-actions` ecosystems, weekly cadence.

### Medium (12)

- **M-CICD-1.** `bun install` lacks `--frozen-lockfile` in CI.
- **M-CICD-2.** `setup-bun@v2 bun-version: latest` — non-reproducible builds across days.
- **M-CICD-3.** `RELEASE_BUILD=1` flag exists in `release.yml:37` only; `build.mjs:39` also triggers on `process.env.CI` → every PR build injects AMO-specific manifest field. Drop the `CI` half; keep only `RELEASE_BUILD`.
- **M-CICD-4.** `manifest.json` version + `package.json` version dual source of truth. Add CI parity step: `test "$(jq -r .version manifest.json)" = "$(jq -r .version package.json)"`.
- **M-CICD-5.** Chrome + Firefox zips bit-identical but `archiver` runs deflate twice. `cp` after first archive saves 200-500 ms.
- **M-CICD-6.** `pack:chrome` script name misleading — produces both Chrome AND Firefox zips. Rename to `pack:zips`.
- **M-CICD-7.** **CI builds bundle WITHOUT `VITE_WEATHER_API_KEY`** → Vite inlines `undefined` → weather widget disabled in CI bundle. **CI tests a different bundle than what ships.** Fix: inject dummy value in CI, OR add Vitest test asserting graceful degradation when key absent.
- **M-CICD-8.** No bundle-size budget. 44 KB→200 KB regression would land silently. Add `JS_BYTES=$(stat -c%s dist/assets/newtab.js); [ "$JS_BYTES" -lt 80000 ]`.
- **M-CICD-9.** `clean.mjs` doesn't clean `web-ext-artifacts/`, `coverage/`, root `tabula-*.zip`/`tabula.xpi` (150 KB stale).
- **M-CICD-10.** `railway.toml` dead config. References `bun run start` which doesn't exist. Delete unless paired with a real proxy server.
- **M-CICD-11.** No GH Pages / static-docs deploy. Privacy policy (Phase 3 C-DOC-1) needs hosted URL for AMO/CWS compliance.
- **M-CICD-12.** `RELEASE_GUIDE.md:160-164` claims Chrome publishing is part of CI — it's commented out. Update doc.

### Low (12)

- L-CICD-1. No `CODEOWNERS`. Single-maintainer fine for now.
- L-CICD-2. No required-reviewer policy (admin-only setting; can't verify in repo).
- L-CICD-3. `softprops/action-gh-release@v2` runs twice in release.yml — could be one step.
- L-CICD-4. `actions/upload-artifact@v4` runs on failure by default. Intentional.
- L-CICD-5. No artifact retention override (default 90d).
- L-CICD-6. `permissions:` only in `release.yml`; `ci.yml` inherits default. Tighten to `contents: read`.
- L-CICD-7. No PR template (`.github/pull_request_template.md`) — Phase 3 M-DOC-4.
- L-CICD-8. No `pre-commit`/`husky`/`lefthook` — acceptable, relies on CI.
- L-CICD-9. `bun-types: latest` floating (also CRIT-BP-6).
- L-CICD-10. No security-vuln issue template; `config.yml` mailto: link would nudge away from public threads.
- L-CICD-11. No `release-please`/`git-cliff` auto-changelog.
- L-CICD-12. No matrix testing (jsdom version compat across 2 versions, low priority).

### Cross-references to prior phases

- C-CICD-1 (SHA pin) hardens against same class as Phase 2's bundle-side dependency posture.
- C-CICD-2 (timeout swallow) operational expression of Phase 3 CI gap.
- C-CICD-3 (secret misclassification) is the CI half of Phase 2 C-SEC-1.
- H-CICD-1/2 (dep review + CodeQL) would catch regressions of Phase 2 C-SEC-2/3 + H-SEC-1.
- H-CICD-3 (Vitest coverage) implements Phase 3 L5.
- H-CICD-8 (Dependabot) addresses Phase 2 dep notes.
- M-CICD-7 (CI bundle key drift) is **novel** — not caught by prior phases.
- M-CICD-10 (railway.toml dead) confirms Phase 3 L-DOC-8.

---

## Combined counts (Phases 1+2+3+4)

| | Crit | High | Med | Low | Total |
|---|---|---|---|---|---|
| Phase 1A (Quality) | 3 | 10 | 16 | 17 | 46 |
| Phase 1B (Architecture) | 3 | 8 | 7 | 5 | 23 |
| Phase 2A (Security) | 3 | 6 | 10 | 8 | 27 |
| Phase 2B (Performance) | 4 | 10 | 11 | 9 | 34 |
| Phase 3A (Tests) | 7 | 10 | 11 | 8 | 36 |
| Phase 3B (Docs) | 4 | 6 | 8 | 8 | 26 |
| Phase 4A (Best practices) | 2 | 6 | 10 | 12 | 30 |
| Phase 4B (CI/CD) | 3 | 8 | 12 | 12 | 35 |
| **Total** | **29** | **64** | **85** | **79** | **257** |
