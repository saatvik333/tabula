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
  if (value === "color" || value === "image") {
    return value;
  }
  return "color";
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

const coerceTimeFormat = (value: unknown, fallback: TimeFormat): TimeFormat => {
  if (value === "12h" || value === "24h") {
    return value;
  }
  return fallback;
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

export const DEFAULT_PALETTE_LIGHT: Palette = MATERIAL_LIGHT;
export const DEFAULT_PALETTE_DARK: Palette = MATERIAL_DARK;
 
const BASE_DEFAULT_SETTINGS: Settings = {
  themeMode: "system",
  background: {
    type: "color",
    color: "#111111",
    imageUrl: "",
    imageData: undefined,
    blur: 24,
  },
  clock: {
    scale: 1,
    rimWidth: 2,
    handWidth: 5,
    dotSize: 8,
    format: "24h",
  },
  palettes: {
    light: MATERIAL_LIGHT,
    dark: MATERIAL_DARK,
  },
  preset: "material",
  tagline: DEFAULT_TAGLINE,
  pinnedTabs: [],
  search: {
    enabled: false,
    engine: "google",
    placeholder: "Search the web",
    position: "top",
  },
};

export const DEFAULT_SETTINGS: Settings = applyPresetToSettings("material", BASE_DEFAULT_SETTINGS);

const mergeClock = (
  value: Partial<Settings["clock"]> | undefined,
  fallback: Settings["clock"],
): Settings["clock"] => ({
  scale: clamp(Number(value?.scale), fallback.scale, 0.5, 2),
  rimWidth: clamp(Number(value?.rimWidth), fallback.rimWidth, 1, 12),
  handWidth: clamp(Number(value?.handWidth), fallback.handWidth, 2, 14),
  dotSize: clamp(Number(value?.dotSize), fallback.dotSize, 4, 24),
  format: coerceTimeFormat(value?.format, fallback.format),
});

const mergeBackground = (
  value: Partial<Settings["background"]> | undefined,
  fallback: Settings["background"],
): Settings["background"] => ({
  type: coerceBackgroundType(value?.type),
  color: isHexColor(value?.color) ? value!.color : fallback.color,
  imageUrl: sanitizeString(value?.imageUrl, ""),
  imageData:
    typeof value?.imageData === "string" && value.imageData.trim().startsWith("data:image/")
      ? value.imageData.trim()
      : undefined,
  blur: clamp(Number(value?.blur), fallback.blur, 0, 40),
});

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
  const initialPreset = presetProvided ? coercePreset(source.preset) : DEFAULT_SETTINGS.preset;
  const tagline = sanitizeTagline(source.tagline, DEFAULT_SETTINGS.tagline);
  const pinnedTabs = sanitizePinnedTabs(source.pinnedTabs, DEFAULT_SETTINGS.pinnedTabs);

  const baseSettings: Settings = {
    themeMode,
    background,
    clock,
    search,
    palettes: {
      light: sanitizePalette(source.palettes?.light, DEFAULT_PALETTE_LIGHT),
      dark: sanitizePalette(source.palettes?.dark, DEFAULT_PALETTE_DARK),
    },
    preset: presetProvided ? initialPreset : DEFAULT_SETTINGS.preset,
    tagline,
    pinnedTabs,
  };

  if (!presetProvided && typeof partial === "undefined") {
    const applied = applyPresetToSettings(DEFAULT_SETTINGS.preset as Exclude<PresetName, "custom">, baseSettings);
    return {
      ...applied,
      themeMode,
      clock,
      search,
    };
  }

  if (presetProvided && initialPreset !== "custom") {
    const applied = applyPresetToSettings(initialPreset as Exclude<PresetName, "custom">, baseSettings);
    return {
      ...applied,
      themeMode,
      clock,
      search,
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
