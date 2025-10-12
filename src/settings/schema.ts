export type ThemeMode = "system" | "light" | "dark";

export type BackgroundType = "color" | "image";

export type SearchEngine = "google" | "bing" | "duckduckgo" | "brave";

export type SearchPosition = "top" | "bottom";

export type Palette = {
  background: string;
  face: string;
  rim: string;
  hand: string;
  accent: string;
};

export type Settings = {
  themeMode: ThemeMode;
  background: {
    type: BackgroundType;
    color: string;
    imageUrl: string;
    blur: number;
  };
  clock: {
    scale: number;
    rimWidth: number;
    handWidth: number;
    dotSize: number;
  };
  palettes: {
    light: Palette;
    dark: Palette;
  };
  search: {
    enabled: boolean;
    engine: SearchEngine;
    placeholder: string;
    position: SearchPosition;
  };
};

export type PartialSettings = Partial<Settings>;

export const SETTINGS_STORAGE_KEY = "tabula:settings";
