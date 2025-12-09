/**
 * Vitest compatibility shim for Bun
 *
 * This module re-exports Bun's test functions with Vitest-compatible names,
 * allowing tests to use `import { describe, expect, it } from "vitest"`
 * while running under Bun's test runner.
 */

export {
  describe,
  test,
  test as it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  mock,
  mock as vi,
  spyOn,
  jest,
} from "bun:test";

// Re-export for vitest/globals compatibility
export type { Mock } from "bun:test";
