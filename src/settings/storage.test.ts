import { beforeEach, describe, expect, it } from "vitest";

import { saveSettings, loadSettings, getCachedSettingsSnapshot, updateSettings } from "$src/settings/storage";
import { DEFAULT_SETTINGS, mergeWithDefaults } from "$src/settings/defaults";
import { SETTINGS_STORAGE_KEY } from "$src/settings/schema";

describe("settings storage", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    delete (globalThis as any).chrome;
    await saveSettings(DEFAULT_SETTINGS);
  });

  it("persists widget anchors to local storage", async () => {
    const settings = mergeWithDefaults({
      widgets: {
        layout: [
          {
            id: "weather",
            x: 200,
            y: 40,
            anchor: { horizontal: "right", vertical: "top", offsetX: 24, offsetY: 12 },
          },
        ],
      },
    });

    await saveSettings(settings);

    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.widgets.layout[0].anchor).toEqual({
      horizontal: "right",
      vertical: "top",
      offsetX: 24,
      offsetY: 12,
    });

    const reloaded = await loadSettings();
    expect(reloaded.widgets.layout[0].anchor).toEqual({
      horizontal: "right",
      vertical: "top",
      offsetX: 24,
      offsetY: 12,
    });
  });

  it("returns defensive clones so cached settings remain immutable", async () => {
    const snapshot = getCachedSettingsSnapshot();
    snapshot.widgets.layout[0].x = 999;
    snapshot.widgets.layout[0].anchor = { horizontal: "left", offsetX: 10 };

    const reloaded = await loadSettings();
    expect(reloaded.widgets.layout[0].x).not.toBe(999);
    expect(reloaded.widgets.layout[0].anchor).not.toEqual({ horizontal: "left", offsetX: 10 });
  });

  it("updates stored anchors when updateSettings merges layout overrides", async () => {
    await updateSettings({
      widgets: {
        layout: [
          {
            id: "weather",
            x: 300,
            y: 60,
            anchor: { horizontal: "right", vertical: "bottom", offsetX: 18, offsetY: 24 },
          },
        ],
      },
    });

    const reloaded = await loadSettings();
    const weather = reloaded.widgets.layout.find((entry) => entry.id === "weather");
    expect(weather).toBeTruthy();
    expect(weather).toMatchObject({ x: 300, y: 60 });
    expect(weather?.anchor).toEqual({
      horizontal: "right",
      vertical: "bottom",
      offsetX: 18,
      offsetY: 24,
    });
  });
});
