# Tabula

<p align="center">
  <img src="src/assets/icons/icon128.png" alt="Tabula Logo" width="80" height="80">
</p>

<p align="center">
  <strong>Your space, no noise.</strong>
</p>

<p align="center">
  <a href="https://github.com/saatvik333/tabula/releases"><img src="https://img.shields.io/github/v/release/saatvik333/tabula?style=flat-square&color=blue" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/saatvik333/tabula?style=flat-square" alt="License"></a>
  <a href="https://github.com/saatvik333/tabula/actions"><img src="https://img.shields.io/github/actions/workflow/status/saatvik333/tabula/release.yml?style=flat-square" alt="CI"></a>
  <a href="https://github.com/sponsors/saatvik333"><img src="https://img.shields.io/badge/sponsor-💖-pink?style=flat-square" alt="Sponsor"></a>
</p>

---

A customizable, minimalist New Tab extension for **Chrome**, **Edge**, **Brave**, and **Firefox**. Features a unique "clock of clocks" display and optional productivity widgets—clean, fast, works offline.

![tabula-themes](https://github.com/user-attachments/assets/68b45fd5-8235-4d26-aaf5-b5fe4b2896ed)

## ✨ Features

### Core

- **Clock of Clocks** — Unique 24-cell digit display with 12/24h formats
- **Customizable Tagline** — Personalized greeting message
- **Pinned Tabs** — Quick access to frequently used sites
- **Built-in Search** — Configurable search engine integration

### Widgets

- **Pomodoro Timer** — Focus sessions with browser notifications
- **Tasks** — Simple todo list that persists across tabs
- **Weather** — Current conditions at a glance

### Appearance

- **13 Color Palettes** — Material, Nord, Catppuccin, Dracula, Tokyo Night, and more
- **Light/Dark/Auto Modes** — System theme integration
- **Custom Backgrounds** — Solid colors, gradients, or images with blur

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js 18+

### Development

```bash
git clone https://github.com/saatvik333/tabula.git
cd tabula
bun install

bun run dev          # Dev server
bun test             # Tests
bun run type-check   # Type check
bun run build        # Production build
```

### Load Extension

**Chrome / Edge / Brave:**

1. Navigate to `chrome://extensions`
2. Enable **Developer mode** → **Load unpacked** → select `dist/`

**Firefox:**

1. Navigate to `about:debugging` → **This Firefox**
2. **Load Temporary Add-on** → select `dist/manifest.json`

## 📁 Project Structure

```
src/
├── app/        # New Tab app composition
├── clock/      # Clock display
├── core/       # Utilities (time, DOM, ticker)
├── pages/      # Page entrypoints
├── settings/   # Schema, defaults, storage
├── widgets/    # Pomodoro, tasks, weather
└── assets/     # Icons, styles
```

## 🎨 Palettes

| Palette     | Style                 |
| ----------- | --------------------- |
| Material    | Clean material design |
| Nord        | Arctic, bluish tones  |
| Catppuccin  | Soothing pastel       |
| Dracula     | Dark purple theme     |
| Tokyo Night | Vibrant city lights   |
| Gruvbox     | Retro, warm colors    |
| Rosé Pine   | Natural, muted        |
| Everforest  | Soft green            |
| One Dark    | Atom-inspired         |
| Solarized   | Precision colors      |
| Monokai     | Iconic syntax         |
| Ayu         | Minimal elegance      |
| Pitch Black | OLED dark             |

## 🔄 Releases

Releases are automated via GitHub Actions. Creating a new GitHub Release triggers:

- Build & test
- Package Chrome/Firefox zips
- Publish to Firefox Add-ons (AMO)

> **Chrome Web Store**: Publish requires a $5 developer fee. [Sponsor this project](https://github.com/sponsors/saatvik333) to help get Tabula on Chrome!

See [RELEASE_GUIDE.md](.github/RELEASE_GUIDE.md) for secrets setup.

## 🤝 Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for development setup and guidelines.

## 📄 License

[MIT](LICENSE) © 2025 Saatvik Sharma
