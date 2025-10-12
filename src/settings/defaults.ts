import type {
  Palette,
  PartialSettings,
  Settings,
  ThemeMode,
  BackgroundType,
  SearchEngine,
  SearchPosition,
} from "$src/settings/schema";

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

export const DEFAULT_PALETTE_LIGHT: Palette = {
  background: "#f8fafc",
  face: "#ffffff",
  rim: "#cbd5f5",
  hand: "#0f172a",
  accent: "#2563eb",
};

export const DEFAULT_PALETTE_DARK: Palette = {
  background: "#0f172a",
  face: "#172554",
  rim: "#334155",
  hand: "#e2e8f0",
  accent: "#38bdf8",
};

export const DEFAULT_SETTINGS: Settings = {
  themeMode: "system",
  background: {
    type: "color",
    color: "#0f172a",
    imageUrl: "",
    blur: 0,
  },
  clock: {
    scale: 1,
    rimWidth: 2,
    handWidth: 5,
    dotSize: 8,
  },
  palettes: {
    light: DEFAULT_PALETTE_LIGHT,
    dark: DEFAULT_PALETTE_DARK,
  },
  search: {
    enabled: false,
    engine: "google",
    placeholder: "Search the web",
    position: "top",
  },
};

const mergeClock = (
  value: Partial<Settings["clock"]> | undefined,
  fallback: Settings["clock"],
): Settings["clock"] => ({
  scale: clamp(Number(value?.scale), fallback.scale, 0.6, 1.4),
  rimWidth: clamp(Number(value?.rimWidth), fallback.rimWidth, 1, 12),
  handWidth: clamp(Number(value?.handWidth), fallback.handWidth, 2, 14),
  dotSize: clamp(Number(value?.dotSize), fallback.dotSize, 4, 24),
});

const mergeBackground = (
  value: Partial<Settings["background"]> | undefined,
  fallback: Settings["background"],
): Settings["background"] => ({
  type: coerceBackgroundType(value?.type),
  color: isHexColor(value?.color) ? value!.color : fallback.color,
  imageUrl: sanitizeString(value?.imageUrl, ""),
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

  const themeMode = coerceThemeMode(source.themeMode);
  const background = mergeBackground(source.background, DEFAULT_SETTINGS.background);
  const clock = mergeClock(source.clock, DEFAULT_SETTINGS.clock);
  const search = mergeSearch(source.search, DEFAULT_SETTINGS.search);

  return {
    themeMode,
    background,
    clock,
    search,
    palettes: {
      light: sanitizePalette(source.palettes?.light, DEFAULT_PALETTE_LIGHT),
      dark: sanitizePalette(source.palettes?.dark, DEFAULT_PALETTE_DARK),
    },
  };
};
