import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("createWeatherWidget", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates widget element with correct classes", async () => {
    const path = "./weather-widget?t=1";
    const { createWeatherWidget } = await import(path);
    const widget = createWeatherWidget();
    expect(widget.element).toBeDefined();
    expect(widget.element.classList.contains("tabula-widget--weather")).toBe(true);
    widget.destroy();
  });

  it("checks cache first and skips fetch if cache is fresh", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    // Populate fresh cache
    const cacheEntry = {
      location: "London",
      locationLabel: "London, UK",
      snapshot: {
        temperatureC: 18,
        temperatureF: 64.4,
        feelsLikeC: 18,
        feelsLikeF: 64.4,
        conditionText: "Sunny",
      },
      timestamp: Date.now(),
    };
    localStorage.setItem("tabula:weather-cache", JSON.stringify(cacheEntry));

    const path = "./weather-widget?t=2";
    const { createWeatherWidget } = await import(path);
    const widget = createWeatherWidget();
    widget.update({
      enabled: true,
      location: "London",
      unit: "metric",
    });

    await Promise.resolve();

    expect(fetchSpy).not.toHaveBeenCalled();

    const tempEl = widget.element.querySelector(".tabula-widget__value");
    expect(tempEl?.textContent).toContain("18");
    expect(tempEl?.textContent).toContain("°C");

    widget.destroy();
  });

  it("calls fetch if cache is expired", async () => {
    import.meta.env["VITE_WEATHER_API_KEY"] = "mock-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            location: { name: "London", country: "UK" },
            current: {
              temp_c: 20,
              temp_f: 68,
              feelslike_c: 20,
              feelslike_f: 68,
              condition: { text: "Partly Cloudy" },
            },
          }),
          { status: 200 }
        )
      )
    );

    // Populate expired cache (6 minutes old)
    const cacheEntry = {
      location: "London",
      locationLabel: "London, UK",
      snapshot: {
        temperatureC: 18,
        temperatureF: 64.4,
        feelsLikeC: 18,
        feelsLikeF: 64.4,
        conditionText: "Sunny",
      },
      timestamp: Date.now() - 6 * 60 * 1000,
    };
    localStorage.setItem("tabula:weather-cache", JSON.stringify(cacheEntry));

    const path = "./weather-widget?t=3";
    const { createWeatherWidget } = await import(path);
    const widget = createWeatherWidget();
    widget.update({
      enabled: true,
      location: "London",
      unit: "metric",
    });

    await Promise.resolve();

    expect(fetchSpy).toHaveBeenCalled();
    widget.destroy();
  });

  it("handles empty API key and displays key guard message", async () => {
    import.meta.env["VITE_WEATHER_API_KEY"] = "";
    const path = "./weather-widget?t=4";
    const { createWeatherWidget } = await import(path);
    const widget = createWeatherWidget();
    widget.update({
      enabled: true,
      location: "London",
      unit: "metric",
    });

    await Promise.resolve();

    const statusEl = widget.element.querySelector(".tabula-widget__status");
    expect(statusEl?.textContent).toBe("Weather API key not configured.");
    widget.destroy();
  });
});
