import { describe, expect, it } from "vitest";

import { resolveTheme } from "$src/settings/theme";

describe("resolveTheme", () => {
  it("uses system preference when mode is system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("returns explicit mode when provided", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});
