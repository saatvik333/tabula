# Release Guide

## Automated Releases

Creating a GitHub Release or pushing a `v*` tag triggers the full CI pipeline:

1. **Build & Test** — Type check, unit tests, Firefox lint
2. **Package** — Creates Chrome and Firefox zips
3. **Publish** — Auto-publishes to both stores (if secrets configured)
4. **Attach** — Zips and signed XPI attached to GitHub Release

## Version Bump

Update `version` in `manifest.json`, then create a release.

## Required Secrets

### Firefox Add-ons (AMO)

| Secret           | Description              |
| ---------------- | ------------------------ |
| `AMO_JWT_ISSUER` | AMO API key (JWT issuer) |
| `AMO_JWT_SECRET` | AMO API secret           |

Get from [AMO Developer Hub → Manage API Keys](https://addons.mozilla.org/developers/addon/api/key/)

### Chrome Web Store

| Secret                 | Description          |
| ---------------------- | -------------------- |
| `CHROME_EXTENSION_ID`  | Extension ID         |
| `CHROME_CLIENT_ID`     | OAuth2 client ID     |
| `CHROME_CLIENT_SECRET` | OAuth2 client secret |
| `CHROME_REFRESH_TOKEN` | OAuth2 refresh token |

## Manual Build

```bash
bun install
bun run build
bun run pack:chrome
```

Creates:

- `tabula-<version>-chrome.zip`
- `tabula-<version>-firefox.zip`

## Store Listing Assets

- **Screenshots**: New Tab (light/dark), Options page
- **Icon**: 128×128 PNG
- **Banner**: 1400×560 (Chrome promo, optional)
- **Privacy**: No data collected
