# Changelog

This document records the chronological history of updates, improvements, and
bug fixes for the Tabula browser extension.

[TOC]

## v1.2.1

This release improves architectural separation, security, and performance.

### Added

- Root-level [PRIVACY.md](/PRIVACY.md) detailing local storage scopes and sync
  transmission boundaries.
- Content Security Policy (CSP) headers inside manifest declarations.
- Standard [Widget](/src/widgets/widget.ts) interface contract.

### Changed

- Decomposed dashboard layout management out of clock controller into a separate
  [WidgetLayoutManager](/src/app/layout-manager.ts).
- Realigned coordinate edge-anchoring math helper functions to round offsets to
  integers inside [anchor.ts](/src/settings/anchor.ts).
- Configured host permissions in manifest to declare WeatherAPI and Google
  Favicon domains.

### Fixed

- Handled pointer event listener conflicts and corrected layout persistence gaps
  occurring on viewport size changes.
