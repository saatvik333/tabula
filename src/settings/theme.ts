import type { Settings, ThemeMode } from "$src/settings/schema";

export type ThemeVariant = "light" | "dark";

const prefersDarkMediaQuery = "(prefers-color-scheme: dark)";

export const getSystemPrefersDark = (): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(prefersDarkMediaQuery).matches
    : false;

export const resolveTheme = (mode: ThemeMode, prefersDark: boolean): ThemeVariant => {
  if (mode === "system") {
    return prefersDark ? "dark" : "light";
  }
  return mode;
};

export const watchSystemTheme = (callback: (prefersDark: boolean) => void): (() => void) => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }

  const mediaQuery = window.matchMedia(prefersDarkMediaQuery);

  const handler = (event: MediaQueryListEvent): void => {
    callback(event.matches);
  };

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }

  if (typeof mediaQuery.addListener === "function") {
    mediaQuery.addListener(handler);
    return () => mediaQuery.removeListener(handler);
  }

  return () => {};
};

export const getActivePalette = (settings: Settings, theme: ThemeVariant) =>
  theme === "dark" ? settings.palettes.dark : settings.palettes.light;
