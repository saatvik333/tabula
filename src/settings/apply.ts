import type { Settings } from "$src/settings/schema";
import type { ThemeVariant } from "$src/settings/theme";
import { getActivePalette } from "$src/settings/theme";

const formatPixels = (value: number): string => `${value}px`;

const formatBackgroundImage = (settings: Settings): string => {
  const { type, imageUrl } = settings.background;
  if (type !== "image") return "none";
  const trimmed = imageUrl.trim();
  if (!trimmed) return "none";
  return `url(${trimmed})`;
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
  const surfaceVariant = theme === "dark"
    ? "rgba(255, 255, 255, 0.08)"
    : "rgba(15, 23, 42, 0.06)";

  root.style.setProperty("--md-surface", surface);
  root.style.setProperty("--md-surface-container", surfaceContainer);
  root.style.setProperty("--md-surface-container-high", surfaceContainer);
  root.style.setProperty("--md-surface-variant", surfaceVariant);
  root.style.setProperty("--md-outline", outline);
  root.style.setProperty("--md-primary", primary);
  root.style.setProperty("--md-on-primary", surface);
  root.style.setProperty("--md-on-surface", onSurface);
  root.style.setProperty("--md-on-surface-variant", `${onSurface}CC`);
  root.style.setProperty("--md-shadow-1", theme === "dark" ? "0 20px 60px rgba(2,6,23,0.6)" : "0 16px 40px rgba(15,23,42,0.2)");
  root.style.setProperty("--md-shadow-2", theme === "dark" ? "0 10px 30px rgba(2,6,23,0.45)" : "0 14px 36px rgba(15,23,42,0.18)");

  root.style.setProperty("--tabula-background-color", surface);
  root.style.setProperty("--tabula-face-color", surfaceContainer);
  root.style.setProperty("--tabula-rim-color", outline);
  root.style.setProperty("--tabula-hand-color", onSurface);
  root.style.setProperty("--tabula-accent-color", primary);
  root.style.setProperty("--tabula-text-color", onSurface);
  const accentRgb = hexToRgb(primary) ?? "56, 189, 248";
  root.style.setProperty("--tabula-accent-color-rgb", accentRgb);

  root.style.setProperty("--tabula-background-image", formatBackgroundImage(settings));
  root.style.setProperty("--tabula-background-blur", formatPixels(settings.background.blur));

  root.style.setProperty("--tabula-clock-scale", settings.clock.scale.toString());
  root.style.setProperty("--tabula-clock-rim-width", formatPixels(settings.clock.rimWidth));
  root.style.setProperty("--tabula-clock-hand-width", formatPixels(settings.clock.handWidth));
  root.style.setProperty("--tabula-clock-dot-size", formatPixels(settings.clock.dotSize));

  root.style.setProperty("--tabula-background-mode", settings.background.type);

  if (doc.body) {
    doc.body.dataset["backgroundType"] = settings.background.type;
    doc.body.dataset["theme"] = theme;
  }
};
