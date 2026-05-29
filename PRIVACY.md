# Privacy policy

This document describes the privacy practices for the Tabula browser extension.
It explains what data is collected, stored, and transmitted.

[TOC]

## Data storage

Tabula is designed to run locally in your browser. All configuration and
customisation settings are saved inside the browser's local sandbox using the
`chrome.storage` API.

### Sync storage

General dashboard layout preferences, clock styles, and theme choices are stored
using the `chrome.storage.sync` area. This allows your dashboard layout to sync
across all your signed-in browsers automatically.

### Local storage

To prevent exceeding sync storage quotas and crashing the sync service, larger
content datasets like note bodies (inside the notes widget) are stored locally
on the device using the `chrome.storage.local` area. Note content is never
synced across devices.

## Network transmission

Tabula only makes outbound network calls for the following core features:

1. **Quotes widget**: Fetches random quotes from `https://quoteslate.vercel.app`.
2. **Weather widget**: Retrieves forecasts from `https://api.weatherapi.com`
   using your private API key.
3. **Favicon loader**: Retrieves page favicons for your pinned tabs using
   `https://www.google.com/s2/favicons`.

No analytics, user tracking, or telemetry data is collected or transmitted.
