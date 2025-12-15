# Tabula v1.2.1

## 🐛 Bug Fixes

### Quotes Widget Overhaul

- **Switched API**: Changed from ZenQuotes to [QuoteSlate API](https://quoteslate.vercel.app) for more reliable quote delivery
- **Click to Refresh**: Quotes widget now supports clicking to fetch a new random quote
- **Fallback Quote**: Added a fallback quote ("The secret of getting ahead is getting started." — Mark Twain) for when the API is unavailable
- **Better Error Handling**: Improved abort controller handling and loading states

## 🎨 Improvements

### Clock Styling

- **Expanded Dot Size Range**: Extended customization options for clock dot sizes

### Firefox Compliance

- **Data Collection Permissions**: Added required `data_collection_permissions` to Firefox manifest for AMO compliance

## 🧪 Testing

### New Unit Tests

Added comprehensive test coverage with **14 test files** including:

- `dom.test.ts` - DOM utility functions
- `ticker.test.ts` - Timing utilities
- `time.test.ts` - Time formatting
- `clock-display.test.ts` - Clock display component
- `digit-map.test.ts` - Digit mapping logic
- `notes-widget.test.ts` - Notes widget
- `quotes-widget.test.ts` - Quotes widget
- `tasks-widget.test.ts` - Tasks widget
- `settings/*.test.ts` - Settings storage, defaults, theme, and broadcasting

## 🔧 Technical Changes

- Refined style variables in `tokens.css`
- Improved TypeScript types and exports

## 📦 Installation

- **Chrome/Edge/Brave**: Download `tabula-1.2.1-chrome.zip`
- **Firefox**: Download `tabula-1.2.1-firefox.zip` or `tabula.xpi`

**Full Changelog**: [v1.2.0...v1.2.1](https://github.com/saatvik333/tabula/compare/v1.2.0...v1.2.1)
