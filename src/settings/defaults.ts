import type {
  Palette,
  PartialSettings,
  PinnedTab,
  Settings,
  ThemeMode,
  BackgroundType,
  SearchEngine,
  SearchPosition,
  PresetName,
  TimeFormat,
  WidgetsSettings,
  WeatherWidgetSettings,
  PomodoroWidgetSettings,
  TemperatureUnit,
  WidgetLayoutEntry,
  WidgetId,
  WidgetAnchor,
  TaskItem,
} from "$src/settings/schema";
import { applyPresetToSettings, isPresetName } from "$src/settings/presets";

const clamp = (value: number, fallback: number, min: number, max: number): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

const OPTIONAL_HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && OPTIONAL_HEX.test(value.trim());

const coerceThemeMode = (value: unknown): ThemeMode => {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
};

const coerceBackgroundType = (value: unknown): BackgroundType => {
  if (value === "image") {
    return value;
  }
  return "image";
};

const coerceSearchEngine = (value: unknown): SearchEngine => {
  if (value === "google" || value === "bing" || value === "duckduckgo" || value === "brave") {
    return value;
  }
  return "google";
};

const coerceSearchPosition = (value: unknown): SearchPosition => {
  if (value === "top" || value === "bottom") {
    return value;
  }
  return "top";
};

const sanitizeString = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;

const sanitizePalette = (value: unknown, fallback: Palette): Palette => {
  const candidate = value as Partial<Palette> | undefined;
  return {
    background: isHexColor(candidate?.background) ? candidate!.background : fallback.background,
    face: isHexColor(candidate?.face) ? candidate!.face : fallback.face,
    rim: isHexColor(candidate?.rim) ? candidate!.rim : fallback.rim,
    hand: isHexColor(candidate?.hand) ? candidate!.hand : fallback.hand,
    accent: isHexColor(candidate?.accent) ? candidate!.accent : fallback.accent,
  };
};

const sanitizeBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const coercePreset = (value: unknown): PresetName => {
  if (isPresetName(value)) {
    return value;
  }
  return "material";
};

const coerceTemperatureUnit = (value: unknown, fallback: TemperatureUnit): TemperatureUnit => {
  if (value === "metric" || value === "imperial") {
    return value;
  }
  return fallback;
};

const coerceTimeFormat = (value: unknown, fallback: TimeFormat): TimeFormat => {
  if (value === "12h" || value === "24h") {
    return value;
  }
  return fallback;
};

const KNOWN_WIDGET_IDS: readonly WidgetId[] = ["weather", "pomodoro", "tasks"];

const normaliseOffset = (value: unknown): number | undefined => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return undefined;
  }
  return Math.round(numeric);
};

const cloneAnchor = (anchor: WidgetAnchor | undefined): WidgetAnchor | undefined => {
  if (!anchor) {
    return undefined;
  }

  const cloned: WidgetAnchor = {};

  if (anchor.horizontal === "left" || anchor.horizontal === "right") {
    cloned.horizontal = anchor.horizontal;
    const offset = normaliseOffset(anchor.offsetX);
    if (typeof offset === "number") {
      cloned.offsetX = offset;
    }
  }

  if (anchor.vertical === "top" || anchor.vertical === "bottom") {
    cloned.vertical = anchor.vertical;
    const offset = normaliseOffset(anchor.offsetY);
    if (typeof offset === "number") {
      cloned.offsetY = offset;
    }
  }

  return Object.keys(cloned).length ? cloned : undefined;
};

const sanitizeAnchor = (value: unknown): WidgetAnchor | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<WidgetAnchor> & { offsetX?: unknown; offsetY?: unknown };
  const anchor: WidgetAnchor = {};

  if (candidate.horizontal === "left" || candidate.horizontal === "right") {
    anchor.horizontal = candidate.horizontal;
    const offsetX = normaliseOffset(candidate.offsetX);
    if (typeof offsetX === "number") {
      anchor.offsetX = offsetX;
    }
  }

  if (candidate.vertical === "top" || candidate.vertical === "bottom") {
    anchor.vertical = candidate.vertical;
    const offsetY = normaliseOffset(candidate.offsetY);
    if (typeof offsetY === "number") {
      anchor.offsetY = offsetY;
    }
  }

  if (!anchor.horizontal && !anchor.vertical) {
    return undefined;
  }

  return anchor;
};

const sanitizeWidgetLayout = (
  value: unknown,
  fallback: WidgetLayoutEntry[],
): WidgetLayoutEntry[] => {
  if (!Array.isArray(value)) {
    return fallback.map((entry) => {
      const cloned = entry.anchor ? cloneAnchor(entry.anchor) : undefined;
      return cloned ? { ...entry, anchor: cloned } : { id: entry.id, x: entry.x, y: entry.y };
    });
  }

  const seen = new Set<WidgetId>();
  const result: WidgetLayoutEntry[] = [];
  const fallbackMap = new Map<WidgetId, WidgetLayoutEntry>(fallback.map((entry) => [entry.id, entry]));

  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as Partial<WidgetLayoutEntry> & { id?: string };
    if (typeof candidate.id !== "string") continue;
    const id = candidate.id as WidgetId;
    if (!KNOWN_WIDGET_IDS.includes(id)) continue;
    if (seen.has(id)) continue;
    const x = Number(candidate.x);
    const y = Number(candidate.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    seen.add(id);
    const anchor = sanitizeAnchor(candidate.anchor);
    result.push(anchor ? { id, x, y, anchor } : { id, x, y });
  }

  for (const id of KNOWN_WIDGET_IDS) {
    if (seen.has(id)) continue;
    const fallbackEntry = fallbackMap.get(id) ?? { id, x: 0, y: 0 };
    const cloned = fallbackEntry.anchor ? cloneAnchor(fallbackEntry.anchor) : undefined;
    result.push(cloned ? { id, x: fallbackEntry.x, y: fallbackEntry.y, anchor: cloned } : { id, x: fallbackEntry.x, y: fallbackEntry.y });
  }

  return result;
};

const DEFAULT_TAGLINE = "Your space, no noise";

const sanitizeTagline = (value: unknown, fallback: string): string => {
  const text = sanitizeString(value, fallback);
  return text.slice(0, 120);
};

const isValidUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const sanitizePinnedTab = (value: unknown): PinnedTab | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PinnedTab>;
  const url = typeof candidate.url === "string" ? candidate.url.trim() : "";
  if (!url || !isValidUrl(url)) {
    return null;
  }
  let title = sanitizeString(candidate.title, "");
  if (!title) {
    try {
      const parsed = new URL(url);
      title = parsed.hostname.replace(/^www\./i, "") || parsed.hostname;
    } catch {
      title = url;
    }
  }
  const idCandidate = typeof candidate.id === "string" ? candidate.id.trim() : "";
  const iconCandidate = typeof candidate.icon === "string" ? candidate.icon.trim() : "";
  const id = idCandidate || url;
  const base: PinnedTab = { id, title, url };
  if (iconCandidate) {
    base.icon = iconCandidate;
  }
  return base;
};

const sanitizePinnedTabs = (value: unknown, fallback: PinnedTab[]): PinnedTab[] => {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  const seen = new Set<string>();
  const result: PinnedTab[] = [];
  for (const entry of value) {
    if (result.length >= 12) break;
    const sanitized = sanitizePinnedTab(entry);
    if (!sanitized) continue;
    if (seen.has(sanitized.id)) continue;
    seen.add(sanitized.id);
    result.push(sanitized);
  }
  return result;
};

const MAX_TASK_ITEMS = 60;
const MAX_TASK_LENGTH = 120;

const sanitizeTaskItem = (value: unknown): TaskItem | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<TaskItem> & { text?: unknown };
  const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
  if (!text) {
    return null;
  }
  const truncated = text.slice(0, MAX_TASK_LENGTH);
  const idCandidate = typeof candidate.id === "string" && candidate.id.trim().length > 0 ? candidate.id.trim() : null;
  const id = idCandidate ?? `task-${Math.random().toString(36).slice(2, 10)}`;
  return { id, text: truncated };
};

const sanitizeTaskItems = (value: unknown, fallback: TaskItem[]): TaskItem[] => {
  if (!Array.isArray(value)) {
    return fallback.map((item) => ({ ...item }));
  }
  const seen = new Set<string>();
  const result: TaskItem[] = [];
  for (const entry of value) {
    if (result.length >= MAX_TASK_ITEMS) break;
    const sanitized = sanitizeTaskItem(entry);
    if (!sanitized) continue;
    if (seen.has(sanitized.id)) continue;
    seen.add(sanitized.id);
    result.push(sanitized);
  }
  return result;
};

const sanitizeWeather = (
  value: Partial<WeatherWidgetSettings> | undefined,
  fallback: WeatherWidgetSettings,
): WeatherWidgetSettings => ({
  enabled: sanitizeBoolean(value?.enabled, fallback.enabled),
  location: sanitizeString(value?.location, fallback.location),
  unit: coerceTemperatureUnit(value?.unit, fallback.unit),
});

const clampMinutes = (value: unknown, fallback: number, min: number, max: number): number =>
  clamp(Number(value), fallback, min, max);

const sanitizePomodoro = (
  value: Partial<PomodoroWidgetSettings> | undefined,
  fallback: PomodoroWidgetSettings,
): PomodoroWidgetSettings => {
  const focusMinutes = clampMinutes(value?.focusMinutes, fallback.focusMinutes, 5, 90);
  const breakMinutes = clampMinutes(value?.breakMinutes, fallback.breakMinutes, 1, 45);
  const longBreakMinutes = clampMinutes(value?.longBreakMinutes, fallback.longBreakMinutes, 5, 60);
  const cyclesBeforeLongBreak = clampMinutes(
    value?.cyclesBeforeLongBreak,
    fallback.cyclesBeforeLongBreak,
    1,
    8,
  );

  return {
    enabled: sanitizeBoolean(value?.enabled, fallback.enabled),
    focusMinutes,
    breakMinutes,
    longBreakMinutes,
    cyclesBeforeLongBreak,
  };
};

const sanitizeTasks = (
  value: Partial<Settings["widgets"]["tasks"]> | undefined,
  fallback: Settings["widgets"]["tasks"],
): Settings["widgets"]["tasks"] => ({
  enabled: sanitizeBoolean(value?.enabled, fallback.enabled),
  items: sanitizeTaskItems(value?.items, fallback.items),
});

const mergeWidgets = (
  value: Partial<WidgetsSettings> | undefined,
  fallback: WidgetsSettings,
): WidgetsSettings => ({
  layout: sanitizeWidgetLayout(value?.layout, fallback.layout),
  weather: sanitizeWeather(value?.weather, fallback.weather),
  pomodoro: sanitizePomodoro(value?.pomodoro, fallback.pomodoro),
  tasks: sanitizeTasks(value?.tasks, fallback.tasks),
});
const MATERIAL_LIGHT: Palette = {
  background: "#f3f4f6",
  face: "#ffffff",
  rim: "#d1d5db",
  hand: "#111827",
  accent: "#6b7280",
};

const MATERIAL_DARK: Palette = {
  background: "#111827",
  face: "#1f2937",
  rim: "#374151",
  hand: "#f3f4f6",
  accent: "#9ca3af",
};

const DEFAULT_WIDGET_LAYOUT: WidgetLayoutEntry[] = [
  { id: "weather", x: 0, y: 0 },
  { id: "pomodoro", x: 0, y: 260 },
  { id: "tasks", x: 0, y: 520 },
];

export const DEFAULT_PALETTE_LIGHT: Palette = MATERIAL_LIGHT;
export const DEFAULT_PALETTE_DARK: Palette = MATERIAL_DARK;

const BASE_DEFAULT_SETTINGS: Settings = {
  themeMode: "system",
  background: {
    type: "image",
    color: "#111111",
    imageUrl: "",
    blur: 12,
  },
  clock: {
    enabled: true,
    scale: 1,
    rimWidth: 2,
    handWidth: 5,
    dotSize: 8,
    format: "24h",
    showSeconds: true,
  },
  palettes: {
    light: MATERIAL_LIGHT,
    dark: MATERIAL_DARK,
  },
  preset: "material",
  tagline: DEFAULT_TAGLINE,
  taglineEnabled: true,
  pinnedTabs: [],
  search: {
    enabled: false,
    engine: "google",
    placeholder: "Search the web",
    position: "top",
  },
  widgets: {
    layout: DEFAULT_WIDGET_LAYOUT.map((entry) => {
      const cloned = entry.anchor ? cloneAnchor(entry.anchor) : undefined;
      return cloned
        ? { id: entry.id, x: entry.x, y: entry.y, anchor: cloned }
        : { id: entry.id, x: entry.x, y: entry.y };
    }),
    weather: {
      enabled: true,
      location: "New York, NY",
      unit: "metric",
    },
    pomodoro: {
      enabled: true,
      focusMinutes: 25,
      breakMinutes: 5,
      longBreakMinutes: 15,
      cyclesBeforeLongBreak: 4,
    },
    tasks: {
      enabled: true,
      items: [],
    },
  },
};

export const DEFAULT_SETTINGS: Settings = applyPresetToSettings("material", BASE_DEFAULT_SETTINGS);

const mergeClock = (
  value: Partial<Settings["clock"]> | undefined,
  fallback: Settings["clock"],
): Settings["clock"] => ({
  enabled: sanitizeBoolean(value?.enabled, fallback.enabled),
  scale: clamp(Number(value?.scale), fallback.scale, 0.5, 2),
  rimWidth: clamp(Number(value?.rimWidth), fallback.rimWidth, 1, 12),
  handWidth: clamp(Number(value?.handWidth), fallback.handWidth, 2, 14),
  dotSize: clamp(Number(value?.dotSize), fallback.dotSize, 4, 24),
  format: coerceTimeFormat(value?.format, fallback.format),
  showSeconds: sanitizeBoolean(value?.showSeconds, fallback.showSeconds),
});

const mergeBackground = (
  value: Partial<Settings["background"]> | undefined,
  fallback: Settings["background"],
): Settings["background"] => {
  const sanitizedImageData =
    typeof value?.imageData === "string" && value.imageData.trim().startsWith("data:image/")
      ? value.imageData.trim()
      : fallback.imageData;

  const background: Settings["background"] = {
    type: coerceBackgroundType(value?.type),
    color: isHexColor(value?.color) ? value!.color : fallback.color,
    imageUrl: sanitizeString(value?.imageUrl, ""),
    blur: clamp(Number(value?.blur), fallback.blur, 0, 40),
  };

  if (typeof sanitizedImageData === "string" && sanitizedImageData.trim().length > 0) {
    background.imageData = sanitizedImageData;
  }

  return background;
};

const mergeSearch = (
  value: Partial<Settings["search"]> | undefined,
  fallback: Settings["search"],
): Settings["search"] => ({
  enabled: sanitizeBoolean(value?.enabled, fallback.enabled),
  engine: coerceSearchEngine(value?.engine),
  placeholder: sanitizeString(value?.placeholder, fallback.placeholder),
  position: coerceSearchPosition(value?.position),
});

export const mergeWithDefaults = (partial: PartialSettings | undefined): Settings => {
  const source = (partial ?? {}) as Partial<Settings>;

  const presetProvided = partial !== undefined && Object.prototype.hasOwnProperty.call(partial as object, "preset");

  const themeMode = coerceThemeMode(source.themeMode);
  const background = mergeBackground(source.background, DEFAULT_SETTINGS.background);
  const clock = mergeClock(source.clock, DEFAULT_SETTINGS.clock);
  const search = mergeSearch(source.search, DEFAULT_SETTINGS.search);
  const widgets = mergeWidgets(source.widgets, DEFAULT_SETTINGS.widgets);
  const initialPreset = presetProvided ? coercePreset(source.preset) : DEFAULT_SETTINGS.preset;
  const tagline = sanitizeTagline(source.tagline, DEFAULT_SETTINGS.tagline);
  const pinnedTabs = sanitizePinnedTabs(source.pinnedTabs, DEFAULT_SETTINGS.pinnedTabs);

  const baseSettings: Settings = {
    themeMode,
    background,
    clock,
    search,
    widgets,
    palettes: {
      light: sanitizePalette(source.palettes?.light, DEFAULT_PALETTE_LIGHT),
      dark: sanitizePalette(source.palettes?.dark, DEFAULT_PALETTE_DARK),
    },
    preset: presetProvided ? initialPreset : DEFAULT_SETTINGS.preset,
    tagline,
    taglineEnabled: sanitizeBoolean(source.taglineEnabled, DEFAULT_SETTINGS.taglineEnabled),
    pinnedTabs,
  };

  if (!presetProvided && typeof partial === "undefined") {
    const applied = applyPresetToSettings(DEFAULT_SETTINGS.preset as Exclude<PresetName, "custom">, baseSettings);
    return {
      ...applied,
      themeMode,
      clock,
      search,
      widgets,
    };
  }

  if (presetProvided && initialPreset !== "custom") {
    const applied = applyPresetToSettings(initialPreset as Exclude<PresetName, "custom">, baseSettings);
    return {
      ...applied,
      themeMode,
      clock,
      search,
      widgets,
    };
  }

  if (!presetProvided) {
    const shouldMarkCustom = Boolean(source.palettes) || Boolean(source.background);
    return {
      ...baseSettings,
      preset: shouldMarkCustom ? "custom" : DEFAULT_SETTINGS.preset,
    };
  }

  return baseSettings;
};
