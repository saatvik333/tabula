import { createClockDisplay, type ClockDisplay } from "$src/clock/clock-display";
import { createElement } from "$src/core/dom";
import { startAlignedSecondTicker, type StopTicker } from "$src/core/ticker";
import { getCurrentTime, timesEqual, type Time } from "$src/core/time";
import { applySettingsToDocument } from "$src/settings/apply";
import type { SearchEngine, Settings } from "$src/settings/schema";
import { loadSettings, subscribeToSettings } from "$src/settings/storage";
import { getSystemPrefersDark, resolveTheme, watchSystemTheme, type ThemeVariant } from "$src/settings/theme";

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
  }

  private buildLayout(): void {
    this.display = createClockDisplay();

    const root = createElement("div", { className: "tabula" });
    root.dataset["searchPosition"] = "top";
    const controls = createElement("div", { className: "tabula-controls" });
    const settingsButton = createElement<HTMLButtonElement>("button", { className: "tabula-settings-button" });
    settingsButton.type = "button";
    settingsButton.innerHTML = `
      <span class="material-symbols-outlined" aria-hidden="true">tune</span>
      <span class="tabula-settings-button__label">Customize</span>
    `;
    settingsButton.setAttribute("aria-label", "Open Tabula settings");
    settingsButton.addEventListener("click", () => this.openOptions());

    controls.append(settingsButton);

    const clockShell = createElement("div", { className: "tabula-clock" });
    clockShell.append(this.display.element);

    const searchForm = this.createSearchForm();

    const tagline = createElement("p", { className: "tabula-tagline" });
    tagline.textContent = "Your space, no noise";

    root.append(controls, searchForm, clockShell, tagline);

    this.container.replaceChildren(root);

    this.root = root;
    this.clockContainer = clockShell;
    this.searchForm = searchForm;
    this.tagline = tagline;
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

    if (search.position === "top") {
      if (this.clockContainer && this.root.children.item(0) !== this.searchForm) {
        this.root.insertBefore(this.searchForm, this.clockContainer);
      }
    } else if (this.clockContainer && this.tagline) {
      const reference = this.tagline;
      if (this.searchForm.nextSibling !== reference) {
        this.root.insertBefore(this.searchForm, reference);
      }
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
    this.display.render(nextTime);
  }
}
