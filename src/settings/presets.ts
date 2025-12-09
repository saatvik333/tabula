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
  // Clean material design palette
  material: {
    light: createPalette("#fafafa", "#ffffff", "#e0e0e0", "#212121", "#757575"),
    dark: createPalette("#121212", "#1e1e1e", "#2d2d2d", "#e0e0e0", "#9e9e9e"),
    background: { color: "#121212", blur: 20 },
  },

  // Nord - Arctic, bluish color palette
  nord: {
    light: createPalette("#eceff4", "#e5e9f0", "#d8dee9", "#2e3440", "#5e81ac"),
    dark: createPalette("#2e3440", "#3b4252", "#434c5e", "#eceff4", "#88c0d0"),
    background: { color: "#2e3440", blur: 18 },
  },

  // Catppuccin Mocha - Warm pastel theme
  catppuccin: {
    light: createPalette("#eff1f5", "#e6e9ef", "#ccd0da", "#4c4f69", "#8839ef"),
    dark: createPalette("#1e1e2e", "#313244", "#45475a", "#cdd6f4", "#cba6f7"),
    background: { color: "#1e1e2e", blur: 22 },
  },

  // Tokyo Night - Vibrant dark theme
  "tokyo-night": {
    light: createPalette("#d5d6db", "#e9e9ed", "#c0c0c8", "#343b59", "#7aa2f7"),
    dark: createPalette("#1a1b26", "#24283b", "#414868", "#a9b1d6", "#7aa2f7"),
    background: { color: "#1a1b26", blur: 20 },
  },

  // Gruvbox - Retro groove colors
  gruvbox: {
    light: createPalette("#fbf1c7", "#f9f5d7", "#d5c4a1", "#3c3836", "#b57614"),
    dark: createPalette("#282828", "#32302f", "#504945", "#ebdbb2", "#d79921"),
    background: { color: "#282828", blur: 18 },
  },

  // Rosé Pine - Elegant pink-tinted theme
  "rose-pine": {
    light: createPalette("#faf4ed", "#fffaf3", "#dfdad9", "#575279", "#907aa9"),
    dark: createPalette("#191724", "#1f1d2e", "#403d52", "#e0def4", "#c4a7e7"),
    background: { color: "#191724", blur: 22 },
  },

  // Dracula - Popular dark theme
  dracula: {
    light: createPalette("#f8f8f2", "#ffffff", "#d6d6d6", "#282a36", "#bd93f9"),
    dark: createPalette("#282a36", "#44475a", "#6272a4", "#f8f8f2", "#bd93f9"),
    background: { color: "#282a36", blur: 20 },
  },

  // Solarized - Precision colors
  solarized: {
    light: createPalette("#fdf6e3", "#eee8d5", "#93a1a1", "#073642", "#268bd2"),
    dark: createPalette("#002b36", "#073642", "#586e75", "#93a1a1", "#2aa198"),
    background: { color: "#002b36", blur: 18 },
  },

  // One Dark - Atom editor theme
  "one-dark": {
    light: createPalette("#fafafa", "#f0f0f0", "#d4d4d4", "#383a42", "#4078f2"),
    dark: createPalette("#282c34", "#21252b", "#3e4451", "#abb2bf", "#61afef"),
    background: { color: "#282c34", blur: 20 },
  },

  // Monokai - Classic code editor theme
  monokai: {
    light: createPalette("#fdfdf6", "#f8f8f2", "#c7c7bb", "#272822", "#f92672"),
    dark: createPalette("#272822", "#3e3d32", "#49483e", "#f8f8f2", "#a6e22e"),
    background: { color: "#272822", blur: 18 },
  },

  // Ayu - Modern minimal theme
  ayu: {
    light: createPalette("#fafafa", "#f8f9fa", "#d8d8d8", "#5c6166", "#ff9940"),
    dark: createPalette("#0d1017", "#131721", "#1f2430", "#bfbdb6", "#ffb454"),
    background: { color: "#0d1017", blur: 22 },
  },

  // Everforest - Comfortable green theme
  everforest: {
    light: createPalette("#fdf6e3", "#f4f0d9", "#d5c4a1", "#5c6a72", "#8da101"),
    dark: createPalette("#2d353b", "#343f44", "#475258", "#d3c6aa", "#a7c080"),
    background: { color: "#2d353b", blur: 20 },
  },

  // Pitch Black - OLED-friendly pure black
  "pitch-black": {
    light: createPalette("#f5f5f5", "#ffffff", "#e0e0e0", "#212121", "#757575"),
    dark: createPalette("#000000", "#0a0a0a", "#1a1a1a", "#ffffff", "#888888"),
    background: { color: "#000000", blur: 24 },
  },
};

export const presetNames: PresetName[] = [
  "material",
  "nord",
  "catppuccin",
  "tokyo-night",
  "gruvbox",
  "rose-pine",
  "dracula",
  "solarized",
  "one-dark",
  "monokai",
  "ayu",
  "everforest",
  "pitch-black",
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

