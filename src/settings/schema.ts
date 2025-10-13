export type ThemeMode = "system" | "light" | "dark";

export type BackgroundType = "image";

export type SearchEngine = "google" | "bing" | "duckduckgo" | "brave";

export type SearchPosition = "top" | "bottom";

export type PresetName =
  | "material"
  | "nord"
  | "catppuccin"
  | "tokyo-night"
  | "gruvbox"
  | "rose-pine"
  | "pitch-black"
  | "everforest"
  | "sunset-haze"
  | "ocean-breeze"
  | "neon-dream"
  | "custom";

export type TimeFormat = "12h" | "24h";

export type TemperatureUnit = "metric" | "imperial";

export type WidgetPlacement = "top-right" | "top-left" | "bottom-right" | "bottom-left";

export type PinnedTab = {
  id: string;
  title: string;
  url: string;
  icon?: string;
};

export type Palette = {
  background: string;
  face: string;
  rim: string;
  hand: string;
  accent: string;
};

export type WeatherWidgetSettings = {
  enabled: boolean;
  location: string;
  unit: TemperatureUnit;
};

export type PomodoroWidgetSettings = {
  enabled: boolean;
  focusMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
};

export type WidgetsSettings = {
  placement: WidgetPlacement;
  weather: WeatherWidgetSettings;
  pomodoro: PomodoroWidgetSettings;
};

export type Settings = {
  themeMode: ThemeMode;
  background: {
    type: BackgroundType;
    color: string;
    imageUrl: string;
    imageData?: string;
    blur: number;
  };
  clock: {
    scale: number;
    rimWidth: number;
    handWidth: number;
    dotSize: number;
    format: TimeFormat;
  };
  palettes: {
    light: Palette;
    dark: Palette;
  };
  preset: PresetName;
  tagline: string;
  pinnedTabs: PinnedTab[];
  search: {
    enabled: boolean;
    engine: SearchEngine;
    placeholder: string;
    position: SearchPosition;
  };
  widgets: WidgetsSettings;
};

export type PartialSettings = Partial<Settings>;

export const SETTINGS_STORAGE_KEY = "tabula:settings";
