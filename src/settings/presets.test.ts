import { describe, expect, it } from "vitest";
import {
  applyPresetToSettings,
  isPresetName,
  getPresetDefinition,
  listAvailablePresets,
} from "./presets";
import { DEFAULT_SETTINGS } from "./defaults";

describe("presets utilities", () => {
  it("checks valid preset names", () => {
    expect(isPresetName("material")).toBe(true);
    expect(isPresetName("nord")).toBe(true);
    expect(isPresetName("custom")).toBe(true);
    expect(isPresetName("unknown")).toBe(false);
  });

  it("lists available presets", () => {
    const list = listAvailablePresets();
    expect(list).toContain("material");
    expect(list).toContain("nord");
    expect(list).not.toContain("custom");
  });

  it("returns preset definitions correctly", () => {
    const def = getPresetDefinition("nord");
    expect(def.light.background).toBe("#eceff4");
  });

  it("applies preset light/dark palettes to settings", () => {
    const initial = { ...DEFAULT_SETTINGS };
    const applied = applyPresetToSettings("nord", initial);

    expect(applied.preset).toBe("nord");
    expect(applied.palettes.light.background).toBe("#eceff4");
    expect(applied.palettes.dark.background).toBe("#2e3440");
    expect(applied.background.color).toBe("#2e3440");
    expect(applied.background.blur).toBe(18);
  });
});
