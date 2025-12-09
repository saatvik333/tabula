# Release Guide

## Quick Start

1. Update `version` in `manifest.json`
2. Create a GitHub Release → CI auto-publishes to both stores

---

## 🔐 Required GitHub Secrets

Go to **Settings → Secrets → Actions** in your repository.

### Firefox Add-ons (AMO)

| Secret           | Description              |
| ---------------- | ------------------------ |
| `AMO_JWT_ISSUER` | AMO API key (JWT issuer) |
| `AMO_JWT_SECRET` | AMO API secret           |

### Chrome Web Store

| Secret                 | Description          |
| ---------------------- | -------------------- |
| `CHROME_EXTENSION_ID`  | Extension ID         |
| `CHROME_CLIENT_ID`     | OAuth2 client ID     |
| `CHROME_CLIENT_SECRET` | OAuth2 client secret |
| `CHROME_REFRESH_TOKEN` | OAuth2 refresh token |

---

## 🦊 Firefox AMO Setup

### 1. Create Developer Account

1. Go to [addons.mozilla.org](https://addons.mozilla.org)
2. Sign in with your Firefox Account (or create one)
3. Click your avatar → **Developer Hub**

### 2. Submit Extension (First Time)

1. Go to [Submit a New Add-on](https://addons.mozilla.org/developers/addon/submit/)
2. Upload your `tabula-x.x.x-firefox.zip`
3. Fill in listing info: name, description, categories
4. Submit for review (usually 1-2 days)

### 3. Get API Keys

1. Go to [AMO API Keys](https://addons.mozilla.org/developers/addon/api/key/)
2. Generate new credentials
3. Copy:
   - **JWT issuer** → `AMO_JWT_ISSUER`
   - **JWT secret** → `AMO_JWT_SECRET`

### 4. Add Secrets to GitHub

```
Repository → Settings → Secrets → Actions → New repository secret
```

Add `AMO_JWT_ISSUER` and `AMO_JWT_SECRET`.

---

## 🌐 Chrome Web Store Setup

### 1. Register as Developer

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. Pay **$5 one-time registration fee**
3. Complete account verification

### 2. Create Extension Listing (First Time)

1. Click **New Item** in Developer Dashboard
2. Upload `tabula-x.x.x-chrome.zip`
3. Fill in:
   - Description, screenshots
   - Category: Productivity
   - Privacy practices (no data collected)
4. Submit for review (1-3 days)

### 3. Get Extension ID

After publishing:

1. Go to Developer Dashboard
2. Click your extension
3. Copy the **Item ID** from the URL → `CHROME_EXTENSION_ID`
   - Example: `https://chrome.google.com/webstore/detail/abcdefghijklmnop`
   - The ID is `abcdefghijklmnop`

### 4. Create OAuth2 Credentials

This is the trickiest part. Follow carefully:

#### Step 1: Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g., "Tabula Extension")

#### Step 2: Enable Chrome Web Store API

1. Go to **APIs & Services → Library**
2. Search "Chrome Web Store API"
3. Click **Enable**

#### Step 3: Create OAuth Client

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Configure consent screen if prompted (External, minimal info)
4. Application type: **Desktop app**
5. Name: "Tabula Publisher"
6. Copy:
   - Client ID → `CHROME_CLIENT_ID`
   - Client Secret → `CHROME_CLIENT_SECRET`

#### Step 4: Get Refresh Token

1. Open this URL in browser (replace `YOUR_CLIENT_ID`):

```
https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&client_id=YOUR_CLIENT_ID&redirect_uri=urn:ietf:wg:oauth:2.0:oob
```

2. Sign in and authorize
3. Copy the **authorization code**

4. Exchange for refresh token:

```bash
curl "https://oauth2.googleapis.com/token" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=YOUR_AUTH_CODE" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=urn:ietf:wg:oauth:2.0:oob"
```

5. Copy `refresh_token` from response → `CHROME_REFRESH_TOKEN`

### 5. Add Secrets to GitHub

Add all four secrets to your repository.

---

## 🚀 Releasing

1. Update `manifest.json` version
2. Commit and push
3. Go to GitHub → Releases → Create new release
4. Tag: `v1.1.0` (must start with `v`)
5. Title: `v1.1.0`
6. Auto-generate release notes
7. Publish

CI will:

- Build and test
- Package for both browsers
- Publish to Chrome Web Store
- Publish to Firefox AMO
- Attach zips to GitHub Release

---

## 📋 Store Listing Assets

| Asset       | Size     | Notes                 |
| ----------- | -------- | --------------------- |
| Icon        | 128×128  | PNG, transparent okay |
| Screenshots | 1280×800 | New Tab, Options page |
| Promo tile  | 440×280  | Chrome (optional)     |
| Marquee     | 1400×560 | Chrome (optional)     |

## Privacy

Both stores require privacy disclosure:

- **Data collected**: None
- **Data usage**: All settings stored locally
- **Remote code**: None
