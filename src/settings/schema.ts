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

export type TaskItem = {
  id: string;
  text: string;
};

export type WidgetId = "weather" | "pomodoro" | "tasks";

export type WidgetLayoutEntry = {
  id: WidgetId;
  x: number;
  y: number;
};

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
  layout: WidgetLayoutEntry[];
  weather: WeatherWidgetSettings;
  pomodoro: PomodoroWidgetSettings;
  tasks: {
    enabled: boolean;
    items: TaskItem[];
  };
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

type BackgroundSettings = Settings["background"];
type ClockSettings = Settings["clock"];
type SearchSettings = Settings["search"];

export type PartialSettings = Partial<Omit<Settings, "background" | "clock" | "search" | "widgets" | "palettes">> & {
  background?: Partial<BackgroundSettings>;
  clock?: Partial<ClockSettings>;
  search?: Partial<SearchSettings>;
  palettes?: {
    light?: Partial<Palette>;
    dark?: Partial<Palette>;
  };
  widgets?: Partial<WidgetsSettings> & {
    layout?: WidgetLayoutEntry[];
    weather?: Partial<WeatherWidgetSettings>;
    pomodoro?: Partial<PomodoroWidgetSettings>;
    tasks?: {
      enabled?: boolean;
      items?: TaskItem[];
    };
  };
};

export const SETTINGS_STORAGE_KEY = "tabula:settings";
