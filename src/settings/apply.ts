import type { Settings } from "$src/settings/schema";
import type { ThemeVariant } from "$src/settings/theme";
import { getActivePalette } from "$src/settings/theme";

const formatPixels = (value: number): string => `${value}px`;

const ALLOWED_DATA_URL = /^data:image\/(png|jpe?g|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/i;

const safeUrl = (url: string): string => {
  try {
    const u = new URL(url);
    if (u.protocol === "https:") {
      return u.toString().replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    }
  } catch {}
  return "";
};

const formatBackgroundImage = (settings: Settings): string => {
  const { type, imageUrl, imageData } = settings.background;
  if (type === "image-data" && imageData && ALLOWED_DATA_URL.test(imageData)) {
    return `url("${imageData}")`;
  }
  if (type === "image-url") {
    const safe = safeUrl(imageUrl);
    if (safe) return `url("${safe}")`;
  }
  return "none";
};

const getBackgroundMode = (settings: Settings): "image" | "color" => {
  const { type, imageUrl, imageData } = settings.background;
  if (type === "image-data" && imageData && ALLOWED_DATA_URL.test(imageData)) {
    return "image";
  }
  if (type === "image-url" && imageUrl && imageUrl.trim().length > 0) {
    return "image";
  }
  return "color";
};

const hexToRgb = (hex: string): string | null => {
  const normalized = hex.replace("#", "");
  if (![3, 6, 8].includes(normalized.length)) {
    return null;
  }

  const value = normalized.length === 3
    ? normalized
        .split("")
        .map((char) => char + char)
        .join("")
    : normalized.slice(0, 6);

  const bigint = Number.parseInt(value, 16);
  if (Number.isNaN(bigint)) return null;

  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r}, ${g}, ${b}`;
};

interface GlassAlphaValues {
  strongTop: number;
  strongBottom: number;
  strongHoverTop: number;
  strongHoverBottom: number;
  subtleTop: number;
  subtleBottom: number;
  surface: number;
  surfaceHover: number;
  field: number;
  fieldFocus: number;
  meridiem: number;
  clockTop: number;
  clockBottom: number;
  highlight: number;
  highlightMuted: number;
}

const GLASS_ALPHA_BY_THEME: Record<ThemeVariant, GlassAlphaValues> = {
  dark: {
    strongTop: 0.38,
    strongBottom: 0.16,
    strongHoverTop: 0.48,
    strongHoverBottom: 0.2,
    subtleTop: 0.24,
    subtleBottom: 0.1,
    surface: 0.19,
    surfaceHover: 0.27,
    field: 0.16,
    fieldFocus: 0.24,
    meridiem: 0.28,
    clockTop: 0.68,
    clockBottom: 0.24,
    highlight: 0.86,
    highlightMuted: 0.24,
  },
  light: {
    strongTop: 0.32,
    strongBottom: 0.13,
    strongHoverTop: 0.4,
    strongHoverBottom: 0.18,
    subtleTop: 0.2,
    subtleBottom: 0.09,
    surface: 0.16,
    surfaceHover: 0.22,
    field: 0.14,
    fieldFocus: 0.2,
    meridiem: 0.22,
    clockTop: 0.6,
    clockBottom: 0.2,
    highlight: 0.8,
    highlightMuted: 0.2,
  },
};

interface ThemedProperties {
  shadow1: string;
  shadow2: string;
  surfaceVariant: string;
}

const PROPERTIES_BY_THEME: Record<ThemeVariant, ThemedProperties> = {
  dark: {
    shadow1: "0 20px 60px rgba(2,6,23,0.6)",
    shadow2: "0 10px 30px rgba(2,6,23,0.45)",
    surfaceVariant: "rgba(255, 255, 255, 0.08)",
  },
  light: {
    shadow1: "0 16px 40px rgba(15,23,42,0.2)",
    shadow2: "0 14px 36px rgba(15,23,42,0.18)",
    surfaceVariant: "rgba(15, 23, 42, 0.06)",
  },
};

export const applySettingsToDocument = (
  doc: Document,
  settings: Settings,
  theme: ThemeVariant,
): void => {
  const root = doc.documentElement;
  const palette = getActivePalette(settings, theme);

  root.dataset["theme"] = theme;

  const onSurface = palette.hand;
  const primary = palette.accent;
  const outline = palette.rim;
  const surface = palette.background;
  const surfaceContainer = palette.face;

  const themeProps = PROPERTIES_BY_THEME[theme];

  // Group 1: Material Design basic variables
  root.style.setProperty("--md-surface", surface);
  root.style.setProperty("--md-surface-container", surfaceContainer);
  root.style.setProperty("--md-surface-container-high", surfaceContainer);
  root.style.setProperty("--md-surface-variant", themeProps.surfaceVariant);
  root.style.setProperty("--md-outline", outline);
  root.style.setProperty("--md-primary", primary);
  root.style.setProperty("--md-on-primary", surface);
  root.style.setProperty("--md-on-surface", onSurface);
  root.style.setProperty("--md-on-surface-variant", `${onSurface}CC`);
  root.style.setProperty("--md-shadow-1", themeProps.shadow1);
  root.style.setProperty("--md-shadow-2", themeProps.shadow2);

  // Group 2: Tabula layout and color hex/RGB variables
  root.style.setProperty("--tabula-background-color", surface);
  root.style.setProperty("--tabula-face-color", surfaceContainer);
  root.style.setProperty("--tabula-rim-color", outline);
  root.style.setProperty("--tabula-hand-color", onSurface);
  root.style.setProperty("--tabula-accent-color", primary);
  root.style.setProperty("--tabula-text-color", onSurface);

  const accentRgb = hexToRgb(primary) ?? "56, 189, 248";
  root.style.setProperty("--tabula-accent-color-rgb", accentRgb);
  const backgroundRgb = hexToRgb(surface) ?? "17, 23, 42";
  const faceRgb = hexToRgb(surfaceContainer) ?? backgroundRgb;
  const rimRgb = hexToRgb(outline) ?? accentRgb;
  const handRgb = hexToRgb(onSurface) ?? "226, 232, 240";
  root.style.setProperty("--tabula-background-color-rgb", backgroundRgb);
  root.style.setProperty("--tabula-face-color-rgb", faceRgb);
  root.style.setProperty("--tabula-rim-color-rgb", rimRgb);
  root.style.setProperty("--tabula-hand-color-rgb", handRgb);

  // Group 3: Tabula glassmorphism transparency values (applied dynamically)
  const glassAlpha = GLASS_ALPHA_BY_THEME[theme];
  for (const [key, val] of Object.entries(glassAlpha)) {
    const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
    root.style.setProperty(`--tabula-glass-alpha-${cssKey}`, val.toString());
  }

  // Group 4: Background and layout configurations
  root.style.setProperty("--tabula-background-image", formatBackgroundImage(settings));
  root.style.setProperty("--tabula-background-blur", formatPixels(settings.background.blur));

  root.style.setProperty("--tabula-clock-scale", settings.clock.scale.toString());
  root.style.setProperty("--tabula-clock-rim-width", formatPixels(settings.clock.rimWidth));
  root.style.setProperty("--tabula-clock-hand-width", formatPixels(settings.clock.handWidth));
  root.style.setProperty("--tabula-clock-dot-size", formatPixels(settings.clock.dotSize));

  const bgMode = getBackgroundMode(settings);
  root.style.setProperty("--tabula-background-mode", bgMode);
  // Expose background mode as data attribute for CSS overrides
  root.dataset["backgroundMode"] = bgMode;

  if (doc.body) {
    doc.body.dataset["theme"] = theme;
  }
};
