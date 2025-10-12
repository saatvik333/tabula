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

export const applySettingsToDocument = (
  doc: Document,
  settings: Settings,
  theme: ThemeVariant,
): void => {
  const root = doc.documentElement;
  const palette = getActivePalette(settings, theme);

  root.dataset["theme"] = theme;

  root.style.setProperty("--tabula-background-color", palette.background);
  root.style.setProperty("--tabula-face-color", palette.face);
  root.style.setProperty("--tabula-rim-color", palette.rim);
  root.style.setProperty("--tabula-hand-color", palette.hand);
  root.style.setProperty("--tabula-accent-color", palette.accent);
  root.style.setProperty("--tabula-text-color", palette.hand);

  const panelBackground = theme === "dark"
    ? "rgba(15, 23, 42, 0.65)"
    : "rgba(255, 255, 255, 0.75)";
  const borderSoft = theme === "dark"
    ? "rgba(248, 250, 252, 0.08)"
    : "rgba(15, 23, 42, 0.08)";
  const borderStrong = theme === "dark"
    ? "rgba(148, 163, 184, 0.35)"
    : "rgba(148, 163, 184, 0.25)";
  const shadowStrong = theme === "dark"
    ? "0 24px 70px rgba(2, 6, 23, 0.55)"
    : "0 20px 60px rgba(15, 23, 42, 0.2)";

  root.style.setProperty("--panel-background", panelBackground);
  root.style.setProperty("--border-soft", borderSoft);
  root.style.setProperty("--border-strong", borderStrong);
  root.style.setProperty("--shadow-strong", shadowStrong);

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
