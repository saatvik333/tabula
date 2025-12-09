# Contributing to Tabula

Thanks for your interest in contributing!

## Development Setup

### Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js 18+

### Commands

```bash
bun install          # Install dependencies
bun run dev          # Start dev server
bun test             # Run tests
bun run type-check   # TypeScript check
bun run build        # Production build
bun run lint:firefox # AMO lint
```

## Project Structure

| Path                 | Description                              |
| -------------------- | ---------------------------------------- |
| `src/app/`           | App composition (clock, search, widgets) |
| `src/clock/`         | Clock display                            |
| `src/core/`          | Utilities (time, DOM, ticker)            |
| `src/pages/`         | Page entrypoints                         |
| `src/settings/`      | Schema, defaults, storage                |
| `src/widgets/`       | Pomodoro, tasks, weather                 |
| `scripts/`           | Build scripts                            |
| `.github/workflows/` | CI automation                            |

## Guidelines

- Prefer pure, well-typed functions
- Avoid `innerHTML` for dynamic content
- Keep tests passing
- Avoid broad permissions in manifest

## Commits & PRs

- Use conventional commits (`feat:`, `fix:`, `docs:`)
- Keep PRs focused with clear descriptions

## Issues

Open an issue with:

- Steps to reproduce
- Expected vs actual behavior
- Browser, OS, screenshots if relevant
