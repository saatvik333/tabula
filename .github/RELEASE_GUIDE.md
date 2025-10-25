# Release guide (Chrome Web Store and Firefox AMO)

## Version bump
- Update `version` in `manifest.json`
- Commit the change (conventional commit recommended)

## Build and package
- Local: `npm install && npm run build && npm run pack:chrome`
- CI: Create a GitHub Release (or push a `vX.Y.Z` tag) to trigger the workflow

Artifacts created:
- `tabula-<version>-chrome.zip`
- `tabula-<version>-firefox.zip`

## Lint and sign
- Firefox lint (AMO): `npm run lint:firefox`
- Optional signing on Release if secrets are configured

## Configure GitHub Actions secrets (optional for auto-publish)
- AMO_JWT_ISSUER / AMO_JWT_SECRET (for Firefox signing)
- CHROME_EXTENSION_ID / CHROME_CLIENT_ID / CHROME_CLIENT_SECRET / CHROME_REFRESH_TOKEN (for Chrome upload/publish)

## Store listing checklist
- Screenshots:
  - New Tab (light theme, clock + tagline)
  - New Tab (dark theme, clock hidden, widgets visible)
  - Options (theme/clock/tagline)
  - Options (widgets/pinned tabs)
- Icon assets:
  - 128×128 PNG
  - 1400×560 banner (Chrome promo) optional
- Descriptions and privacy policy (no data collected)

## Manual publishing
- Chrome: Upload `tabula-<version>-chrome.zip` to the Developer Console and submit for review
- Firefox: Upload `tabula-<version>-firefox.zip` to AMO and submit for review
