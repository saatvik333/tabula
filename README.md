# Tabula

A minimalist new tab extension for Firefox and Chromium-based browsers featuring a unique clock and productivity widgets.

## Features

- **Clock of clocks**: Clean 24-cell digit display with optional seconds
- **Productivity widgets**: Tasks, pomodoro timer, and weather
- **Customization**: Multiple themes, background images, and layout options
- **Cross-browser**: Works on Firefox and all Chromium-based browsers (Chrome, Edge, Brave, etc.)

## Installation

### Development

```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Build for production
npm run build
```

### Browser Installation

**Chromium-based browsers**:
1. Open `chrome://extensions` (or equivalent)
2. Enable Developer mode
3. Load unpacked → select `dist/` folder

**Firefox**:
1. Open `about:debugging`
2. Load Temporary Add-on → select `dist/manifest.json`

## Usage

- **New Tab**: Displays clock and enabled widgets
- **Options Page**: Configure themes, layout, background, search, and widgets
- **Widget Positioning**: Drag widgets to position; they maintain placement on window resize

## License

MIT
