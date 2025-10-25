# Contributing to Tabula

Thanks for your interest in contributing! This guide helps you set up your environment and make effective contributions.

## Development setup
- Prerequisites: Node.js 18+, npm 9+
- Install dependencies:
  - `npm install`
- Start dev server (Vite):
  - `npm run dev`
- Run tests (Vitest):
  - `npm test`
- Type-check (TypeScript):
  - `npm run type-check`

## Building and packaging
- Production build: `npm run build` (outputs to `dist/`)
- Package zips for stores: `npm run pack:chrome` (creates versioned Chrome and Firefox zips)
- Lint for Firefox/AMO: `npm run lint:firefox`

## Project structure
- `src/app/` – App composition (clock, search, tagline, pinned tabs, widgets)
- `src/clock/` – Clock display implementation
- `src/core/` – Core utilities (time, DOM, ticker)
- `src/pages/` – Entrypoints for New Tab and Options pages
- `src/settings/` – Settings schema, defaults, storage, and application
- `src/widgets/` – Pomodoro, tasks, and weather widgets
- `scripts/` – Build/pack scripts
- `.github/workflows/` – CI automation

## Coding guidelines
- Prefer pure, well-typed functions and defensive clones for stored state
- Avoid innerHTML for dynamic content; use DOM APIs
- Keep tests passing (PRs run tests in CI)
- Avoid broad permissions in the extension manifest

## Commit and PR style
- Conventional commits (e.g., `feat:`, `fix:`, `docs:`)
- Keep PRs focused and add context in the description

## Reporting bugs / requesting features
- Open an Issue with clear steps to reproduce and expected behavior
- Include browser, OS, and screenshots if relevant
