# Tabula

Tabula is a customizable, minimalist New Tab extension for Chromium-based browsers and Firefox. It focuses on clarity and control: a beautiful "clock of clocks," distraction-free tagline, and optional productivity widgets.

## Highlights

- Clean, fast, no tracking. Works offline.
- Cross-browser: Chrome, Edge, Brave, and Firefox.
- Sensible defaults with fine-grained customization.

## Features

- Clock
  - Unique 24-cell digit display (the "clock of clocks")
  - 12/24-hour formats
  - Optional seconds
  - Adjustable scale, rim and hand width, dot size
  - Show/hide clock
- Tagline
  - Customizable text
  - Show/hide tagline
- Productivity widgets
  - Tasks
  - Pomodoro timer
  - Weather
  - Drag-to-position; placement persists
- Search
  - Built-in search bar with configurable options
- Pinned tabs
  - Quickly access frequently used sites
- Themes and backgrounds
  - Multiple themes and palettes
  - Background images and theme modes

## Getting started

### Prerequisites
- Node.js 18+
- npm 9+

### Install and develop
```bash
# Install dependencies
npm install

# Start development server (Vite)
npm run dev

# Run unit tests (Vitest)
npm test

# Type-check (TypeScript)
npm run type-check

# Build production extension
npm run build
```

The production build is emitted to `dist/`.

### Load in your browser

Chromium (Chrome/Edge/Brave):
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and choose the `dist/` folder

Firefox:
1. Open `about:debugging`
2. Click "This Firefox"
3. "Load Temporary Add-on" and select `dist/manifest.json`

## Configuration

Use the Options page to configure:
- Clock: show/hide, format (12h/24h), seconds, size and styling controls
- Tagline: show/hide and text
- Widgets: enable, drag to position
- Search: preferences for the search box
- Pinned tabs: manage quick links
- Themes/appearance: theme mode, palettes, and background

All settings are persisted and applied instantly on the New Tab page.

## Project structure

- `src/app/` – New Tab app composition (clock, search, tagline, pinned tabs, widgets)
- `src/clock/` – Clock display implementation
- `src/core/` – Core utilities (time, DOM, ticker)
- `src/pages/` – Entrypoints for New Tab and Options pages
- `src/settings/` – Settings schema, defaults, storage, and application
- `src/widgets/` – Pomodoro, tasks, and weather widgets
- `scripts/` – Build and clean scripts

## Contributing

Issues and PRs are welcome. Please:
- Keep code modular and well-tested (see `npm test`)
- Favor general solutions over special cases
- Follow existing code style conventions

## License

MIT © 2025 Saatvik Sharma
