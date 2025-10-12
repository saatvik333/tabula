import type { Palette, Settings, PresetName } from "$src/settings/schema";

type PresetDefinition = {
  light: Palette;
  dark: Palette;
  background?: {
    color?: string;
    type?: Settings["background"]["type"];
    blur?: number;
  };
  searchAccent?: string;
};

const createPalette = (
  background: string,
  face: string,
  rim: string,
  hand: string,
  accent: string,
): Palette => ({ background, face, rim, hand, accent });

const PRESETS: Record<Exclude<PresetName, "custom">, PresetDefinition> = {
  monochrome: {
    light: createPalette("#f3f4f6", "#ffffff", "#d1d5db", "#111827", "#6b7280"),
    dark: createPalette("#111827", "#1f2937", "#374151", "#f3f4f6", "#9ca3af"),
    background: { color: "#111111", blur: 24 },
  },
  nord: {
    light: createPalette("#e5e9f0", "#eceff4", "#d8dee9", "#2e3440", "#5e81ac"),
    dark: createPalette("#2e3440", "#3b4252", "#4c566a", "#eceff4", "#88c0d0"),
  },
  "catppuccin": {
    light: createPalette("#f5e0dc", "#f2cdcd", "#f5c2e7", "#4c4f69", "#d7827e"),
    dark: createPalette("#1e1e2e", "#302d41", "#575268", "#f8f8f2", "#f5e0dc"),
  },
  "tokyo-night": {
    light: createPalette("#e9edf5", "#dfe6f4", "#c1c9dd", "#1a1b26", "#34548a"),
    dark: createPalette("#1a1b26", "#24283b", "#414868", "#c0caf5", "#7aa2f7"),
  },
  gruvbox: {
    light: createPalette("#fbf1c7", "#f2e5bc", "#d5c4a1", "#3c3836", "#b57614"),
    dark: createPalette("#282828", "#3c3836", "#504945", "#fbf1c7", "#d79921"),
  },
  "rose-pine": {
    light: createPalette("#faf4ed", "#f2e9de", "#d9cec3", "#575279", "#b4637a"),
    dark: createPalette("#191724", "#26233a", "#524f67", "#e0def4", "#eb6f92"),
  },
  "pitch-black": {
    light: createPalette("#f5f5f5", "#ffffff", "#d4d4d4", "#111111", "#6b7280"),
    dark: createPalette("#090909", "#141414", "#1f1f1f", "#f5f5f5", "#9ca3af"),
    background: { color: "#090909", blur: 24 },
  },
  everforest: {
    light: createPalette("#f1f0e8", "#e5e2d9", "#c8c3b8", "#314147", "#8ba089"),
    dark: createPalette("#2f3833", "#3b443d", "#475147", "#d3c6aa", "#a7c080"),
  },
};

export const presetNames: PresetName[] = [
  "monochrome",
  "nord",
  "catppuccin",
  "tokyo-night",
  "gruvbox",
  "rose-pine",
  "pitch-black",
  "everforest",
  "custom",
];

export const isPresetName = (value: unknown): value is PresetName =>
  typeof value === "string" && (presetNames as readonly string[]).includes(value);

export const getPresetDefinition = (preset: Exclude<PresetName, "custom">): PresetDefinition =>
  PRESETS[preset];

export const listAvailablePresets = (): Exclude<PresetName, "custom">[] =>
  Object.keys(PRESETS) as Array<Exclude<PresetName, "custom">>;

export const applyPresetToSettings = (
  preset: Exclude<PresetName, "custom">,
  settings: Settings,
): Settings => {
  const definition = PRESETS[preset];
  const next: Settings = {
    ...settings,
    preset,
    palettes: {
      light: { ...definition.light },
      dark: { ...definition.dark },
    },
    background: {
      ...settings.background,
      color: definition.background?.color ?? settings.background.color,
      type: definition.background?.type ?? settings.background.type,
      blur: definition.background?.blur ?? settings.background.blur,
    },
  };
  return next;
};
