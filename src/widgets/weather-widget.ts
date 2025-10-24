import { createElement } from "$src/core/dom";
import type { TemperatureUnit, WeatherWidgetSettings } from "$src/settings/schema";

type WeatherSnapshot = {
  temperatureC: number;
  temperatureF: number;
  feelsLikeC: number;
  feelsLikeF: number;
  conditionText: string;
};

type WeatherApiResponse = {
  location?: {
    name?: string;
    region?: string;
    country?: string;
  };
  current?: {
    temp_c?: number;
    temp_f?: number;
    feelslike_c?: number;
    feelslike_f?: number;
    condition?: {
      text?: string;
    };
  };
};

const WEATHER_API_KEY = "c921752e6e4a4d68b04162048252210";
const WEATHER_ENDPOINT = "https://api.weatherapi.com/v1/current.json";
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

const convertTemperature = (snapshot: WeatherSnapshot, unit: TemperatureUnit): { value: number; suffix: string } => {
  if (unit === "imperial") {
    return { value: Math.round(snapshot.temperatureF), suffix: "°F" };
  }
  return { value: Math.round(snapshot.temperatureC), suffix: "°C" };
};

const convertFeelsLike = (snapshot: WeatherSnapshot, unit: TemperatureUnit): { value: number; suffix: string } => {
  if (unit === "imperial") {
    return { value: Math.round(snapshot.feelsLikeF), suffix: "°F" };
  }
  return { value: Math.round(snapshot.feelsLikeC), suffix: "°C" };
};

const formatLocationLabel = (payload: WeatherApiResponse): string => {
  const location = payload.location;
  if (!location) return "Unknown location";
  const parts = [location.name, location.region, location.country].filter((part) => part && part.trim().length > 0) as string[];
  if (parts.length === 0) return "Unknown location";
  return parts.join(", ");
};

const pickConditionIcon = (text: string): string => {
  const value = text.toLowerCase();
  if (value.includes("thunder")) return "⛈️";
  if (value.includes("snow") || value.includes("sleet") || value.includes("ice")) return "❄️";
  if (value.includes("rain") || value.includes("drizzle") || value.includes("shower")) return "🌧️";
  if (value.includes("fog") || value.includes("mist") || value.includes("haze") || value.includes("smoke")) return "🌫️";
  if (value.includes("overcast")) return "☁️";
  if (value.includes("cloud")) return "☁️";
  if (value.includes("clear") || value.includes("sun")) return "☀️";
  return "🌡️";
};

const fetchWeatherSnapshot = async (
  location: string,
  signal?: AbortSignal,
): Promise<{ locationLabel: string; snapshot: WeatherSnapshot } | null> => {
  const params = new URLSearchParams({ key: WEATHER_API_KEY, q: location, aqi: "no" });
  const init: RequestInit = signal ? { signal } : {};
  const response = await fetch(`${WEATHER_ENDPOINT}?${params.toString()}`, init);
  if (!response.ok) return null;

  const payload = (await response.json()) as WeatherApiResponse;
  if (!payload.current) return null;

  const temperatureC = payload.current.temp_c ?? Number.NaN;
  const temperatureF = payload.current.temp_f ?? Number.NaN;
  const feelsLikeC = payload.current.feelslike_c ?? Number.NaN;
  const feelsLikeF = payload.current.feelslike_f ?? Number.NaN;

  if (
    !Number.isFinite(temperatureC) ||
    !Number.isFinite(temperatureF) ||
    !Number.isFinite(feelsLikeC) ||
    !Number.isFinite(feelsLikeF)
  ) {
    return null;
  }

  const conditionText = payload.current.condition?.text?.trim() || "Conditions unavailable";

  return {
    locationLabel: formatLocationLabel(payload),
    snapshot: {
      temperatureC,
      temperatureF,
      feelsLikeC,
      feelsLikeF,
      conditionText,
    },
  };
};

class WeatherWidget {
  private requestId = 0;
  private refreshHandle: number | null = null;
  private settings: WeatherWidgetSettings = { enabled: true, location: "", unit: "metric" };

  readonly element: HTMLElement;

  private readonly titleEl: HTMLElement;
  private readonly conditionEl: HTMLElement;
  private readonly temperatureEl: HTMLElement;
  private readonly apparentEl: HTMLElement;
  private readonly statusEl: HTMLElement;

  constructor() {
    this.element = createElement("div", { className: "tabula-card tabula-widget tabula-widget--weather" });

    this.titleEl = createElement("p", { className: "tabula-widget__title" });
    this.conditionEl = createElement("p", { className: "tabula-widget__meta" });
    const header = createElement("div", { className: "tabula-widget__header" });
    header.append(this.titleEl, this.conditionEl);

    this.temperatureEl = createElement("p", { className: "tabula-widget__value tabula-widget__value--xl" });
    this.apparentEl = createElement("p", { className: "tabula-widget__meta" });
    this.statusEl = createElement("p", { className: "tabula-widget__status" });

    this.element.append(header, this.temperatureEl, this.apparentEl, this.statusEl);
    this.element.hidden = true;
    this.element.style.display = "none";
  }

  update(settings: WeatherWidgetSettings): void {
    this.settings = settings;
    if (!settings.enabled) {
      this.element.hidden = true;
      this.element.style.display = "none";
      this.clearRefreshTimer();
      return;
    }

    this.element.hidden = false;
    this.element.style.display = "";
    const location = settings.location.trim();

    if (!location) {
      this.showStatus("Set a location in settings to see local weather.");
      this.displayPlaceholder();
      this.clearRefreshTimer();
      return;
    }

    this.loadSnapshot(location);
  }

  destroy(): void {
    this.clearRefreshTimer();
  }

  private async loadSnapshot(location: string): Promise<void> {
    const currentRequest = ++this.requestId;
    this.showStatus("Updating weather…");

    const controller = new AbortController();
    const cleanup = () => controller.abort();

    try {
      const result = await fetchWeatherSnapshot(location, controller.signal);
      if (!result) {
        this.showStatus("Weather data temporarily unavailable.");
        this.displayPlaceholder(location);
        this.clearRefreshTimer();
        return;
      }

      if (currentRequest !== this.requestId) {
        return;
      }

      this.renderSnapshot(result.locationLabel, result.snapshot);
      this.scheduleRefresh();
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      console.warn("Weather widget error", error);
      this.showStatus("Unable to reach the weather service.");
      this.displayPlaceholder(location);
      this.clearRefreshTimer();
    } finally {
      cleanup();
    }
  }

  private renderSnapshot(locationLabel: string, snapshot: WeatherSnapshot): void {
    const { unit } = this.settings;
    const temperature = convertTemperature(snapshot, unit);
    const apparent = convertFeelsLike(snapshot, unit);
    const icon = pickConditionIcon(snapshot.conditionText);

    this.titleEl.textContent = locationLabel;
    this.conditionEl.textContent = `${icon} ${snapshot.conditionText}`;
    this.temperatureEl.textContent = `${temperature.value}${temperature.suffix}`;
    this.apparentEl.textContent = `Feels like ${apparent.value}${apparent.suffix}`;
    this.showStatus("Updated just now");
  }

  private displayPlaceholder(locationLabel?: string): void {
    this.titleEl.textContent = locationLabel ?? "Weather";
    this.conditionEl.textContent = "Awaiting data";
    this.temperatureEl.textContent = "--";
    this.apparentEl.textContent = "";
  }

  private showStatus(message: string): void {
    this.statusEl.textContent = message;
  }

  private scheduleRefresh(): void {
    this.clearRefreshTimer();
    this.refreshHandle = window.setTimeout(() => {
      if (!this.settings.enabled) return;
      this.loadSnapshot(this.settings.location.trim());
    }, REFRESH_INTERVAL_MS);
  }

  private clearRefreshTimer(): void {
    if (this.refreshHandle !== null) {
      window.clearTimeout(this.refreshHandle);
      this.refreshHandle = null;
    }
  }
}

export type WeatherWidgetController = {
  element: HTMLElement;
  update: (settings: WeatherWidgetSettings) => void;
  destroy: () => void;
};

export const createWeatherWidget = (): WeatherWidgetController => {
  const widget = new WeatherWidget();
  return {
    element: widget.element,
    update: (settings) => widget.update(settings),
    destroy: () => widget.destroy(),
  };
};
