# Contributing to Tabula

Thank you for your interest in contributing to Tabula! To ensure a smooth process
for everyone, please follow these guidelines when contributing.

## Commit Sign-off

We require all commits to be signed off using Git's sign-off feature. This
signifies that you agree to the Developer Certificate of Origin (DCO).

To sign off a commit, use the `-s` or `--signoff` flag:

```bash
git commit -s -m "feat: Add new layout snappings"
```

## Creating Pull Requests

When you are ready to submit a pull request, please follow these steps:

1. Base your pull request on the `main` branch.
1. Ensure all code compiles cleanly using the type checker:
   ```bash
   bun run type-check
   ```
1. Verify that all automated tests pass successfully:
   ```bash
   bun test
   ```
1. Fill out the pull request template completely.

## Test Writing

We expect all new features and bug fixes to be covered by unit tests. Unit tests
should be colocated with the source code under test, using `.test.ts` filenames.

We use the Bun test runner for standard unit tests, and Vitest for coverage and
jsdom-based environment verification.

**Coverage target**: Aim for ≥50% statement coverage on any new module you add.
Run `bun run test:coverage` to see the current report.

**Fuzz / property-based testing**: There is no fuzz harness yet. For security-
sensitive sanitizers (e.g. `sanitizeImageUrl`, `sanitizePinnedUrl`), add
parametrized `it.each` tables with malicious inputs as a substitute.

**Snapshot tests**: Not used in this project. Prefer explicit DOM assertions
over snapshot diffs, which are brittle when className strings change.

## Import Conventions

- Always use `import type { ... }` for type-only imports (`verbatimModuleSyntax`
  is enabled).
- Use the `$src/` path alias for all cross-directory imports — never `../../`.
- No default exports; named exports only.

## Pre-commit Hooks

There are no mandatory pre-commit hooks (no Husky/lefthook). CI gates every
merge via `bun run type-check && bun test && bun run build`. This is intentional
to keep the contributor setup fast — a single `bun install` is all you need.

## Sensitive Change Guidance

If you are proposing changes that affect user privacy, data persistence, or external
network traffic, please open an issue first to discuss the design with project
maintainers. These include:

* Changes to host permissions in `manifest.json`.
* New outbound network fetch endpoints.
* Modifications to storage schema keys or synchronization pathways.
