import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, mergeWithDefaults } from "$src/settings/defaults";
import { getPresetDefinition } from "$src/settings/presets";

describe("mergeWithDefaults", () => {
  it("returns defaults when no override provided", () => {
    expect(mergeWithDefaults(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it("merges nested clock settings while respecting bounds", () => {
    const result = mergeWithDefaults({
      clock: {
        scale: 2,
        rimWidth: -10,
        handWidth: 3,
        dotSize: 100,
      },
    });

    expect(result.clock.scale).toBeCloseTo(1.4);
    expect(result.clock.rimWidth).toBeCloseTo(1);
    expect(result.clock.handWidth).toBeCloseTo(3);
    expect(result.clock.dotSize).toBeCloseTo(24);
    expect(result.preset).toBe(DEFAULT_SETTINGS.preset);
  });

  it("sanitises colour values", () => {
    const result = mergeWithDefaults({
      palettes: {
        light: {
          background: DEFAULT_SETTINGS.palettes.light.background,
          face: DEFAULT_SETTINGS.palettes.light.face,
          rim: DEFAULT_SETTINGS.palettes.light.rim,
          hand: DEFAULT_SETTINGS.palettes.light.hand,
          accent: DEFAULT_SETTINGS.palettes.light.accent,
        },
        dark: {
          background: "#123456",
          face: "not-a-color",
          rim: "#abcdef",
          hand: "#ffeedd",
          accent: "#000000",
        },
      },
    });

    expect(result.palettes.dark.background).toBe("#123456");
    expect(result.palettes.dark.face).toBe(DEFAULT_SETTINGS.palettes.dark.face);
    expect(result.preset).toBe("custom");
  });

  it("normalises search configuration", () => {
    const result = mergeWithDefaults({
      search: {
        enabled: true,
        engine: "duckduckgo",
        placeholder: "Find...",
        position: "bottom",
      },
    });

    expect(result.search.enabled).toBe(true);
    expect(result.search.engine).toBe("duckduckgo");
    expect(result.search.position).toBe("bottom");
    expect(result.search.placeholder).toBe("Find...");
  });

  it("applies preset definitions when provided", () => {
    const result = mergeWithDefaults({ preset: "nord" });
    const definition = getPresetDefinition("nord");

    expect(result.preset).toBe("nord");
    expect(result.palettes.light).toEqual(definition.light);
    expect(result.palettes.dark).toEqual(definition.dark);
  });

  it("falls back to default preset when unknown", () => {
    const result = mergeWithDefaults({
      // @ts-expect-error testing invalid preset input
      preset: "unknown",
    });

    expect(result.preset).toBe("monochrome");
  });
});
