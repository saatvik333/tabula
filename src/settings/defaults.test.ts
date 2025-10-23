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
        scale: 5,
        rimWidth: -10,
        handWidth: 3,
        dotSize: 100,
        format: DEFAULT_SETTINGS.clock.format,
      },
    });

    expect(result.clock.scale).toBeCloseTo(2);
    expect(result.clock.rimWidth).toBeCloseTo(1);
    expect(result.clock.handWidth).toBeCloseTo(3);
    expect(result.clock.dotSize).toBeCloseTo(24);
    expect(result.preset).toBe(DEFAULT_SETTINGS.preset);
    expect(result.clock.format).toBe(DEFAULT_SETTINGS.clock.format);
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

  it("accepts valid background uploads and rejects invalid data", () => {
    const valid = mergeWithDefaults({
      background: {
        type: "image",
        imageUrl: "https://example.com/wallpaper.jpg",
        imageData: "data:image/png;base64,Zm9v",
      },
    });

    expect(valid.background.type).toBe("image");
    expect(valid.background.imageData).toBe("data:image/png;base64,Zm9v");

    const invalid = mergeWithDefaults({
      background: {
        type: "image",
        imageData: "not-a-data-url",
      },
    });

    expect(invalid.background.imageData).toBeUndefined();
  });

  it("sanitises widget settings", () => {
    const result = mergeWithDefaults({
      widgets: {
        weather: {
          enabled: true,
          location: "  London  ",
          unit: "imperial",
        },
        pomodoro: {
          enabled: true,
          focusMinutes: 120,
          breakMinutes: -5,
          longBreakMinutes: 80,
          cyclesBeforeLongBreak: 12,
        },
      },
    });

    expect(result.widgets.weather.location).toBe("London");
    expect(result.widgets.weather.unit).toBe("imperial");
    expect(result.widgets.pomodoro.focusMinutes).toBe(90);
    expect(result.widgets.pomodoro.breakMinutes).toBe(1);
    expect(result.widgets.pomodoro.longBreakMinutes).toBe(60);
    expect(result.widgets.pomodoro.cyclesBeforeLongBreak).toBe(8);
    expect(result.widgets.layout).toHaveLength(DEFAULT_SETTINGS.widgets.layout.length);
  });

  it("sanitises widget layout entries", () => {
    const result = mergeWithDefaults({
      widgets: {
        layout: [
          { id: "weather", x: 120, y: 200 },
          // invalid entry should be ignored
          { id: "pomodoro", x: Number.NaN, y: 100 },
        ] as any,
      },
    });

    const layout = result.widgets.layout;
    expect(layout).toHaveLength(2);
    const weather = layout.find((entry) => entry.id === "weather");
    expect(weather).toMatchObject({ x: 120, y: 200 });
    const defaultPomodoro = DEFAULT_SETTINGS.widgets.layout.find((entry) => entry.id === "pomodoro");
    expect(layout.find((entry) => entry.id === "pomodoro")).toEqual(defaultPomodoro);
  });

  it("coerces time format and preserves defaults when invalid", () => {
    const result = mergeWithDefaults({
      clock: {
        ...DEFAULT_SETTINGS.clock,
        format: "12h",
      },
    });

    expect(result.clock.format).toBe("12h");

    const fallback = mergeWithDefaults({
      clock: {
        ...DEFAULT_SETTINGS.clock,
        // @ts-expect-error testing invalid input
        format: "invalid",
      },
    });

    expect(fallback.clock.format).toBe(DEFAULT_SETTINGS.clock.format);
  });

  it("sanitises tagline and pinned tabs", () => {
    const result = mergeWithDefaults({
      tagline: "  Custom tagline   ",
      pinnedTabs: [
        {
          id: "one",
          title: "Example",
          url: "https://example.com",
        },
        {
          // invalid url should be dropped
          id: "two",
          title: "Invalid",
          url: "notaurl",
        },
      ],
    });

    expect(result.tagline).toBe("Custom tagline");
    expect(result.pinnedTabs).toHaveLength(1);
    expect(result.pinnedTabs[0]).toMatchObject({ title: "Example", url: "https://example.com" });
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

    expect(result.preset).toBe("material");
  });
});
