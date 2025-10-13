import { createElement } from "$src/core/dom";
import type { TemperatureUnit, WeatherWidgetSettings } from "$src/settings/schema";

type GeoResult = {
  latitude: number;
  longitude: number;
  name: string;
  country?: string;
};

type WeatherSnapshot = {
  temperatureC: number;
  apparentTemperatureC: number;
  conditionCode: number;
};

const GEOCODE_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

const WEATHER_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: "Clear sky", icon: "☀️" },
  1: { label: "Mainly clear", icon: "🌤️" },
  2: { label: "Partly cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁️" },
  45: { label: "Foggy", icon: "🌫️" },
  48: { label: "Rime fog", icon: "🌫️" },
  51: { label: "Light drizzle", icon: "🌦️" },
  53: { label: "Drizzle", icon: "🌦️" },
  55: { label: "Heavy drizzle", icon: "🌧️" },
  56: { label: "Freezing drizzle", icon: "🥶" },
  57: { label: "Freezing drizzle", icon: "🥶" },
  61: { label: "Light rain", icon: "🌦️" },
  63: { label: "Rain", icon: "🌧️" },
  65: { label: "Heavy rain", icon: "🌧️" },
  66: { label: "Freezing rain", icon: "🥶" },
  67: { label: "Freezing rain", icon: "🥶" },
  71: { label: "Light snow", icon: "🌨️" },
  73: { label: "Snow", icon: "🌨️" },
  75: { label: "Heavy snow", icon: "❄️" },
  77: { label: "Snow grains", icon: "❄️" },
  80: { label: "Light showers", icon: "🌦️" },
  81: { label: "Rain showers", icon: "🌧️" },
  82: { label: "Heavy showers", icon: "🌧️" },
  85: { label: "Snow showers", icon: "🌨️" },
  86: { label: "Heavy snow showers", icon: "❄️" },
  95: { label: "Thunderstorm", icon: "⛈️" },
  96: { label: "Thunderstorm & hail", icon: "⛈️" },
  99: { label: "Thunderstorm & hail", icon: "⛈️" },
};

const convertTemperature = (valueC: number, unit: TemperatureUnit): { value: number; suffix: string } => {
  if (unit === "imperial") {
    return { value: Math.round((valueC * 9) / 5 + 32), suffix: "°F" };
  }
  return { value: Math.round(valueC), suffix: "°C" };
};

const formatLocationLabel = ({ name, country }: GeoResult): string => {
  if (country) return `${name}, ${country}`;
  return name;
};

const geocodeLocation = async (query: string, signal?: AbortSignal): Promise<GeoResult | null> => {
  const url = `${GEOCODE_ENDPOINT}?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  const response = await fetch(url, { signal });
  if (!response.ok) return null;
  const payload = (await response.json()) as { results?: Array<{ name: string; latitude: number; longitude: number; country?: string }> };
  const result = payload.results?.[0];
  if (!result) return null;
  return {
    latitude: result.latitude,
    longitude: result.longitude,
    name: result.name,
    country: result.country,
  };
};

const fetchWeatherSnapshot = async (
  coords: GeoResult,
  signal?: AbortSignal,
): Promise<{ locationLabel: string; snapshot: WeatherSnapshot } | null> => {
  const params = new URLSearchParams({
    latitude: coords.latitude.toString(),
    longitude: coords.longitude.toString(),
    current: "temperature_2m,apparent_temperature,weather_code",
    forecast_days: "1",
    timezone: "auto",
  });

  const response = await fetch(`${WEATHER_ENDPOINT}?${params.toString()}`, { signal });
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    current?: {
      temperature_2m?: number;
      apparent_temperature?: number;
      weather_code?: number;
    };
  };

  if (!payload.current) return null;

  const temperatureC = payload.current.temperature_2m ?? NaN;
  if (!Number.isFinite(temperatureC)) return null;

  return {
    locationLabel: formatLocationLabel(coords),
    snapshot: {
      temperatureC,
      apparentTemperatureC: payload.current.apparent_temperature ?? temperatureC,
      conditionCode: payload.current.weather_code ?? 0,
    },
  };
};

const resolveCondition = (code: number): { label: string; icon: string } => {
  return WEATHER_CODES[code] ?? { label: "Conditions unavailable", icon: "？" };
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
    this.element = createElement("div", { className: "tabula-widget tabula-widget--weather" });

    this.titleEl = createElement("p", { className: "tabula-widget__title" });
    this.conditionEl = createElement("p", { className: "tabula-widget__meta" });
    const header = createElement("div", { className: "tabula-widget__header" });
    header.append(this.titleEl, this.conditionEl);

    this.temperatureEl = createElement("p", { className: "tabula-widget__value tabula-widget__value--xl" });
    this.apparentEl = createElement("p", { className: "tabula-widget__meta" });
    this.statusEl = createElement("p", { className: "tabula-widget__status" });

    this.element.append(header, this.temperatureEl, this.apparentEl, this.statusEl);
    this.element.hidden = true;
  }

  update(settings: WeatherWidgetSettings): void {
    this.settings = settings;
    if (!settings.enabled) {
      this.element.hidden = true;
      this.clearRefreshTimer();
      return;
    }

    const location = settings.location.trim();
    this.element.hidden = false;

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
      const geo = await geocodeLocation(location, controller.signal);
      if (!geo) {
        this.showStatus("Couldn't locate that place.");
        this.displayPlaceholder();
        this.clearRefreshTimer();
        return;
      }

      const result = await fetchWeatherSnapshot(geo, controller.signal);
      if (!result) {
        this.showStatus("Weather data temporarily unavailable.");
        this.displayPlaceholder(formatLocationLabel(geo));
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
      this.displayPlaceholder();
      this.clearRefreshTimer();
    } finally {
      cleanup();
    }
  }

  private renderSnapshot(locationLabel: string, snapshot: WeatherSnapshot): void {
    const { unit } = this.settings;
    const condition = resolveCondition(snapshot.conditionCode);
    const temperature = convertTemperature(snapshot.temperatureC, unit);
    const apparent = convertTemperature(snapshot.apparentTemperatureC, unit);

    this.titleEl.textContent = locationLabel;
    this.conditionEl.textContent = `${condition.icon} ${condition.label}`;
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
