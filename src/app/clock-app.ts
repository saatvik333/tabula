import { createClockDisplay, type ClockDisplay } from "$src/clock/clock-display";
import { createElement } from "$src/core/dom";
import { startAlignedSecondTicker, type StopTicker } from "$src/core/ticker";
import { formatTimeForDisplay, getCurrentTime, timesEqual, type Meridiem, type Time } from "$src/core/time";
import { applySettingsToDocument } from "$src/settings/apply";
import type { PinnedTab, SearchEngine, Settings } from "$src/settings/schema";
import { loadSettings, subscribeToSettings } from "$src/settings/storage";
import { getSystemPrefersDark, resolveTheme, watchSystemTheme, type ThemeVariant } from "$src/settings/theme";
import { createWeatherWidget, type WeatherWidgetController } from "$src/widgets/weather-widget";
import { createPomodoroWidget, type PomodoroWidgetController } from "$src/widgets/pomodoro-widget";

type TimeSource = () => Time;

type TickerFactory = (tick: () => void) => StopTicker;

const SEARCH_ENGINES: Record<SearchEngine, (query: string) => string> = {
  google: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  bing: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
  duckduckgo: (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
  brave: (query) => `https://search.brave.com/search?q=${encodeURIComponent(query)}`,
};

export class ClockApp {
  private readonly timeSource: TimeSource;

  private readonly tickerFactory: TickerFactory;

  private display: ClockDisplay | null = null;

  private stopTicker: StopTicker | null = null;

  private currentTime: Time | null = null;

  private settings: Settings | null = null;

  private systemPrefersDark = getSystemPrefersDark();

  private activeTheme: ThemeVariant = "dark";

  private unsubscribeSettings: (() => void) | null = null;

  private stopSystemWatcher: (() => void) | null = null;

  private root: HTMLElement | null = null;

  private clockContainer: HTMLElement | null = null;

  private searchForm: HTMLFormElement | null = null;

  private searchInput: HTMLInputElement | null = null;

  private tagline: HTMLElement | null = null;

  private pinnedSection: HTMLElement | null = null;

  private pinnedList: HTMLElement | null = null;

  private meridiemBadge: HTMLElement | null = null;

  private widgetsContainer: HTMLElement | null = null;

  private weatherWidget: WeatherWidgetController | null = null;

  private pomodoroWidget: PomodoroWidgetController | null = null;

  constructor(
    private readonly container: HTMLElement,
    timeSource: TimeSource = getCurrentTime,
    tickerFactory: TickerFactory = startAlignedSecondTicker,
  ) {
    this.timeSource = timeSource;
    this.tickerFactory = tickerFactory;
  }

  start(): void {
    this.buildLayout();
    this.render(true);
    this.stopTicker = this.tickerFactory(() => this.render());

    this.unsubscribeSettings = subscribeToSettings((settings) => {
      this.onSettingsChanged(settings);
    });

    void loadSettings().then((settings) => this.onSettingsChanged(settings));
  }

  stop(): void {
    if (this.stopTicker) {
      this.stopTicker();
      this.stopTicker = null;
    }

    if (this.unsubscribeSettings) {
      this.unsubscribeSettings();
      this.unsubscribeSettings = null;
    }

    if (this.stopSystemWatcher) {
      this.stopSystemWatcher();
      this.stopSystemWatcher = null;
    }

    if (this.weatherWidget) {
      this.weatherWidget.destroy();
      this.weatherWidget = null;
    }

    if (this.pomodoroWidget) {
      this.pomodoroWidget.destroy();
      this.pomodoroWidget = null;
    }
  }

  private buildLayout(): void {
    this.display = createClockDisplay();

    const root = createElement("div", { className: "tabula" });
    root.dataset["searchPosition"] = "top";
    const controls = createElement("div", { className: "tabula-controls" });
    const settingsButton = createElement<HTMLButtonElement>("button", { className: "tabula-settings-button" });
    settingsButton.type = "button";
    settingsButton.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">settings</span>`;
    settingsButton.setAttribute("aria-label", "Open Tabula settings");
    settingsButton.title = "Customize Tabula";
    settingsButton.addEventListener("click", () => this.openOptions());

    controls.append(settingsButton);

    const clockShell = createElement("div", { className: "tabula-clock" });
    clockShell.append(this.display.element);

    const meridiemBadge = createElement("span", { className: "tabula-clock-meridiem" });
    meridiemBadge.hidden = true;
    clockShell.append(meridiemBadge);

    const searchForm = this.createSearchForm();

    const pinnedSection = createElement("div", { className: "tabula-pinned" });
    pinnedSection.classList.add("is-hidden");
    const pinnedList = createElement("div", { className: "tabula-pinned__list" });
    pinnedSection.append(pinnedList);

    const tagline = createElement("p", { className: "tabula-tagline" });
    tagline.textContent = "Your space, no noise";

    const widgetsContainer = createElement("aside", { className: "tabula-widgets" });
    const weatherWidget = createWeatherWidget();
    const pomodoroWidget = createPomodoroWidget();
    widgetsContainer.append(weatherWidget.element, pomodoroWidget.element);

    root.append(controls, clockShell, pinnedSection, tagline);
    root.insertBefore(searchForm, clockShell);
    root.append(widgetsContainer);

    this.container.replaceChildren(root);

    this.root = root;
    this.clockContainer = clockShell;
    this.searchForm = searchForm;
    this.tagline = tagline;
    this.pinnedSection = pinnedSection;
    this.pinnedList = pinnedList;
    this.meridiemBadge = meridiemBadge;
    this.widgetsContainer = widgetsContainer;
    this.weatherWidget = weatherWidget;
    this.pomodoroWidget = pomodoroWidget;
  }

  private createSearchForm(): HTMLFormElement {
    const form = createElement<HTMLFormElement>("form", { className: "tabula-search" });
    form.classList.add("is-hidden");
    const input = createElement<HTMLInputElement>("input", { className: "tabula-search__input" });
    input.setAttribute("type", "search");
    input.setAttribute("name", "query");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("aria-label", "Search");

    const button = createElement<HTMLButtonElement>("button", { className: "tabula-search__button" });
    button.type = "submit";
    button.innerHTML = `
      <span class="material-symbols-outlined" aria-hidden="true">search</span>
      <span class="tabula-search__label">Search</span>
    `;

    form.append(input, button);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = input.value.trim();
      if (!query || !this.settings?.search.enabled) return;
      const engine = this.settings.search.engine;
      const builder = SEARCH_ENGINES[engine] ?? SEARCH_ENGINES.google;
      window.location.href = builder(query);
    });

    this.searchInput = input;
    return form;
  }

  private onSettingsChanged(settings: Settings): void {
    this.settings = settings;
    this.configureSystemWatcher(settings.themeMode);
    this.refreshTheme();
    this.updateSearch(settings);
    this.updateTagline(settings);
    this.updatePinnedTabs(settings);
    this.updateWidgets(settings);
    this.render(true);
  }

  private configureSystemWatcher(mode: Settings["themeMode"]): void {
    if (mode === "system") {
      if (!this.stopSystemWatcher) {
        this.stopSystemWatcher = watchSystemTheme((prefersDark) => {
          this.systemPrefersDark = prefersDark;
          this.refreshTheme();
        });
      }
    } else if (this.stopSystemWatcher) {
      this.stopSystemWatcher();
      this.stopSystemWatcher = null;
    }
  }

  private refreshTheme(): void {
    if (!this.settings) return;
    this.activeTheme = resolveTheme(this.settings.themeMode, this.systemPrefersDark);
    applySettingsToDocument(document, this.settings, this.activeTheme);
  }

  private updateSearch(settings: Settings): void {
    if (!this.root || !this.searchForm || !this.searchInput) return;

    const { search } = settings;
    this.root.classList.toggle("tabula--search-enabled", search.enabled);
    this.root.dataset["searchPosition"] = search.position;

    this.searchForm.classList.toggle("is-hidden", !search.enabled);
    this.searchInput.placeholder = search.placeholder;

    const clock = this.clockContainer;
    const pinned = this.pinnedSection;

    if (search.position === "top") {
      if (clock && this.searchForm.nextSibling !== clock) {
        this.root.insertBefore(this.searchForm, clock);
      }
    } else if (pinned) {
      if (this.searchForm.nextSibling !== pinned) {
        this.root.insertBefore(this.searchForm, pinned);
      }
    }
  }

  private updateTagline(settings: Settings): void {
    if (!this.tagline) return;
    this.tagline.textContent = settings.tagline;
  }

  private updatePinnedTabs(settings: Settings): void {
    if (!this.pinnedSection || !this.pinnedList) return;
    const tabs: PinnedTab[] = settings.pinnedTabs;
    this.pinnedSection.classList.toggle("is-hidden", tabs.length === 0);
    this.pinnedList.replaceChildren();

    if (tabs.length === 0) {
      if (this.settings) {
        this.updateSearch(this.settings);
      }
      return;
    }

    const fragment = document.createDocumentFragment();

    tabs.forEach((tab) => {
      const item = createElement<HTMLAnchorElement>("a", { className: "tabula-pinned__item" });
      item.href = tab.url;
      item.target = "_blank";
      item.rel = "noreferrer noopener";
      item.title = tab.title;

      const iconWrapper = createElement("span", { className: "tabula-pinned__icon" });
      if (tab.icon) {
        const image = createElement<HTMLImageElement>("img", { className: "tabula-pinned__icon-image" });
        image.src = tab.icon;
        image.alt = "";
        image.loading = "lazy";
        iconWrapper.append(image);
      } else {
        const fallback = createElement("span", { className: "tabula-pinned__icon-fallback" });
        fallback.textContent = tab.title.slice(0, 1).toUpperCase();
        iconWrapper.append(fallback);
      }

      const label = createElement("span", { className: "tabula-pinned__label" });
      label.textContent = tab.title;

      item.append(iconWrapper, label);
      fragment.appendChild(item);
    });

    this.pinnedList.appendChild(fragment);

    if (this.settings) {
      this.updateSearch(this.settings);
    }
  }

  private updateMeridiem(indicator: Meridiem | null): void {
    if (!this.meridiemBadge) return;
    if (indicator) {
      this.meridiemBadge.textContent = indicator;
      this.meridiemBadge.hidden = false;
    } else {
      this.meridiemBadge.textContent = "";
      this.meridiemBadge.hidden = true;
    }
  }

  private openOptions(): void {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage) {
        chrome.runtime.openOptionsPage();
        return;
      }
      if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
        const url = chrome.runtime.getURL("options.html");
        window.open(url, "_blank", "noopener");
        return;
      }
    } catch (error) {
      console.warn("Failed to open options page via chrome.runtime", error);
    }

    window.open("options.html", "_blank", "noopener");
  }

  private render(force = false): void {
    if (!this.display) return;

    const nextTime = this.timeSource();

    if (!force && this.currentTime && timesEqual(this.currentTime, nextTime)) {
      return;
    }

    this.currentTime = nextTime;
    const format = this.settings?.clock.format ?? "24h";
    const formatted = formatTimeForDisplay(nextTime, format);
    this.display.render({ hours: formatted.hours, minutes: formatted.minutes, seconds: formatted.seconds });
    this.updateMeridiem(formatted.meridiem);
  }

  private updateWidgets(settings: Settings): void {
    if (!this.widgetsContainer || !this.weatherWidget || !this.pomodoroWidget) return;

    this.weatherWidget.update(settings.widgets.weather);
    this.pomodoroWidget.update(settings.widgets.pomodoro);

    const allDisabled = !settings.widgets.weather.enabled && !settings.widgets.pomodoro.enabled;
    this.widgetsContainer.classList.toggle("is-hidden", allDisabled);
  }
}
