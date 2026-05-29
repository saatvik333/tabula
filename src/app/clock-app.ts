import { createClockDisplay } from "$src/clock/clock-display";
import type { ClockDisplay } from "$src/clock/clock-display";
import { createElement } from "$src/core/dom";
import { startAlignedSecondTicker } from "$src/core/ticker";
import type { StopTicker } from "$src/core/ticker";
import { formatTimeForDisplay, getCurrentTime, timesEqual } from "$src/core/time";
import type { Meridiem, Time } from "$src/core/time";
import { applySettingsToDocument } from "$src/settings/apply";
import type {
  PinnedTab,
  SearchEngine,
  Settings,
  TaskItem,
  WidgetId,
} from "$src/settings/schema";
import {
  cloneSettings,
  getCachedSettingsSnapshot,
  loadSettings,
  subscribeToSettings,
  updateSettings,
} from "$src/settings/storage";
import { getSystemPrefersDark, resolveTheme, watchSystemTheme } from "$src/settings/theme";
import type { ThemeVariant } from "$src/settings/theme";
import { createWeatherWidget } from "$src/widgets/weather-widget";
import type { WeatherWidgetController } from "$src/widgets/weather-widget";
import { createPomodoroWidget } from "$src/widgets/pomodoro-widget";
import type { PomodoroWidgetController } from "$src/widgets/pomodoro-widget";
import { createTasksWidget } from "$src/widgets/tasks-widget";
import type { TasksWidgetController } from "$src/widgets/tasks-widget";
import { createNotesWidget } from "$src/widgets/notes-widget";
import type { NotesWidgetController } from "$src/widgets/notes-widget";
import { createQuotesWidget } from "$src/widgets/quotes-widget";
import type { QuotesWidgetController } from "$src/widgets/quotes-widget";
import { WidgetLayoutManager } from "./layout-manager";

// Firefox uses `browser` namespace for WebExtension APIs
declare const browser: typeof chrome | undefined;

type TimeSource = () => Time;

type TickerFactory = (tick: () => void) => StopTicker;

const SEARCH_ENGINES: Record<SearchEngine, (query: string) => string> = {
  google: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  bing: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
  duckduckgo: (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
  brave: (query) => `https://search.brave.com/search?q=${encodeURIComponent(query)}`,
};




const isValidUrlScheme = (url: string): boolean => {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const getFaviconUrl = (url: string): string => {
  try {
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch {
    return '';
  }
};

export class ClockApp {
  private readonly timeSource: TimeSource;

  private readonly tickerFactory: TickerFactory;

  private display: ClockDisplay | null = null;

  private stopTicker: StopTicker | null = null;

  private currentTime: Time | null = null;

  private settings: Settings | null = null;

  private previousSettings: Settings | null = null;

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
  private tasksWidget: TasksWidgetController | null = null;
  private notesWidget: NotesWidgetController | null = null;
  private quotesWidget: QuotesWidgetController | null = null;

  private widgetElements: Partial<Record<WidgetId, HTMLElement>> = {};
  private readonly layoutManager: WidgetLayoutManager;

  private readonly handleTasksChange = (items: TaskItem[]): void => {
    if (!this.settings) {
      return;
    }

    if (!this.settings.widgets.tasks.enabled) {
      return;
    }

    const nextItems = items.slice(0, 60).map((item) => ({ ...item }));
    const widgets = {
      ...this.settings.widgets,
      tasks: {
        ...this.settings.widgets.tasks,
        items: nextItems,
      },
    };

    this.settings = {
      ...this.settings,
      widgets,
    };

    void updateSettings({
      widgets: {
        tasks: {
          enabled: this.settings.widgets.tasks.enabled,
          items: nextItems,
        },
      },
    });
  };

  private readonly handleNotesChange = (content: string): void => {
    if (!this.settings) {
      return;
    }

    if (!this.settings.widgets.notes.enabled) {
      return;
    }

    const widgets = {
      ...this.settings.widgets,
      notes: {
        ...this.settings.widgets.notes,
        content,
      },
    };

    this.settings = {
      ...this.settings,
      widgets,
    };

    void updateSettings({
      widgets: {
        notes: {
          enabled: this.settings.widgets.notes.enabled,
          content,
        },
      },
    });
  };

  constructor(
    private readonly container: HTMLElement,
    timeSource: TimeSource = getCurrentTime,
    tickerFactory: TickerFactory = startAlignedSecondTicker,
  ) {
    this.timeSource = timeSource;
    this.tickerFactory = tickerFactory;
    this.layoutManager = new WidgetLayoutManager(
      this.widgetElements,
      () => this.settings,
      (settings) => { this.settings = settings; },
    );
  }

  start(): void {
    this.buildLayout();
    this.hydrateFromCache();
    this.render(true);
    this.stopTicker = this.tickerFactory(() => this.render());
    window.addEventListener("resize", this.layoutManager.handleWindowResize);

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

    window.removeEventListener("resize", this.layoutManager.handleWindowResize);

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
    if (this.tasksWidget) {
      this.tasksWidget.destroy();
      this.tasksWidget = null;
    }
  }

  private buildLayout(): void {
    this.display = createClockDisplay();

    const root = createElement("div", { className: "tabula" });
    root.dataset["searchPosition"] = "top";
    const controls = createElement("div", { className: "tabula-controls" });
    const settingsButton = createElement<HTMLButtonElement>("button", {
      className: "tabula-button tabula-button--fab tabula-button--ghost tabula-settings-button",
    });
    settingsButton.type = "button";
    const settingsIcon = createElement("span", { className: "material-symbols-outlined" });
    settingsIcon.setAttribute("aria-hidden", "true");
    settingsIcon.textContent = "settings";
    settingsButton.append(settingsIcon);
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
    const tasksWidget = createTasksWidget({
      onChange: (items) => this.handleTasksChange(items),
    });
    const notesWidget = createNotesWidget();
    notesWidget.setChangeHandler((content) => this.handleNotesChange(content));
    const quotesWidget = createQuotesWidget();
    
    this.prepareWidget(weatherWidget.element, "weather");
    this.prepareWidget(pomodoroWidget.element, "pomodoro");
    this.prepareWidget(tasksWidget.element, "tasks");
    this.prepareWidget(notesWidget.element, "notes");
    this.prepareWidget(quotesWidget.element, "quotes");
    widgetsContainer.append(
      weatherWidget.element,
      pomodoroWidget.element,
      tasksWidget.element,
      notesWidget.element,
      quotesWidget.element
    );

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
    this.tasksWidget = tasksWidget;
    this.notesWidget = notesWidget;
    this.quotesWidget = quotesWidget;


  }

  private createSearchForm(): HTMLFormElement {
    const form = createElement<HTMLFormElement>("form", { className: "tabula-search tabula-card tabula-card--subtle" });
    form.classList.add("is-hidden");
    const input = createElement<HTMLInputElement>("input", { className: "tabula-search__input tabula-input" });
    input.setAttribute("type", "search");
    input.setAttribute("name", "query");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("aria-label", "Search");

    const button = createElement<HTMLButtonElement>("button", {
      className: "tabula-search__button tabula-button tabula-button--primary",
    });
    button.type = "submit";
    const searchIcon = createElement("span", { className: "material-symbols-outlined" });
    searchIcon.setAttribute("aria-hidden", "true");
    searchIcon.textContent = "search";
    const searchLabel = createElement("span", { className: "tabula-search__label" });
    searchLabel.textContent = "Search";
    button.append(searchIcon, searchLabel);

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

  private prepareWidget(element: HTMLElement, id: WidgetId): void {
    element.dataset["widgetId"] = id;
    this.widgetElements[id] = element;
    element.classList.add("tabula-widget--initial");
    element.addEventListener("pointerdown", (event) => this.layoutManager.beginWidgetDrag(id, element, event));
  }


  private hasAppearanceChanged(newSettings: Settings): boolean {
    if (!this.previousSettings) return true;
    const prev = this.previousSettings;
    // Check theme mode
    if (prev.themeMode !== newSettings.themeMode) return true;
    // Check background
    if (prev.background.type !== newSettings.background.type) return true;
    if (prev.background.imageUrl !== newSettings.background.imageUrl) return true;
    if (prev.background.imageData !== newSettings.background.imageData) return true;
    if (prev.background.blur !== newSettings.background.blur) return true;
    if (prev.background.color !== newSettings.background.color) return true;
    // Check clock settings
    if (prev.clock.scale !== newSettings.clock.scale) return true;
    if (prev.clock.rimWidth !== newSettings.clock.rimWidth) return true;
    if (prev.clock.handWidth !== newSettings.clock.handWidth) return true;
    if (prev.clock.dotSize !== newSettings.clock.dotSize) return true;
    // Check palettes
    const prevLight = prev.palettes.light;
    const newLight = newSettings.palettes.light;
    if (prevLight.background !== newLight.background || prevLight.face !== newLight.face ||
        prevLight.rim !== newLight.rim || prevLight.hand !== newLight.hand ||
        prevLight.accent !== newLight.accent) return true;
    const prevDark = prev.palettes.dark;
    const newDark = newSettings.palettes.dark;
    if (prevDark.background !== newDark.background || prevDark.face !== newDark.face ||
        prevDark.rim !== newDark.rim || prevDark.hand !== newDark.hand ||
        prevDark.accent !== newDark.accent) return true;
    return false;
  }


  private hasPinnedTabsChanged(newSettings: Settings): boolean {
    if (!this.previousSettings) return true;
    const prevTabs = this.previousSettings.pinnedTabs;
    const newTabs = newSettings.pinnedTabs;
    const prevShowIcons = this.previousSettings.pinnedTabsShowIcons;
    const newShowIcons = newSettings.pinnedTabsShowIcons;
    // Check if show icons setting changed
    if (prevShowIcons !== newShowIcons) return true;
    // Check array length
    if (prevTabs.length !== newTabs.length) return true;
    // Compare each tab
    for (let i = 0; i < prevTabs.length; i++) {
      const prev = prevTabs[i];
      const next = newTabs[i];
      if (!prev || !next) return true;
      if (prev.id !== next.id || prev.url !== next.url ||
          prev.title !== next.title || prev.icon !== next.icon) return true;
    }
    return false;
  }

  private onSettingsChanged(settings: Settings): void {
    if (this.settings && JSON.stringify(this.settings) === JSON.stringify(settings)) {
      return;
    }
    const layoutChanged = this.layoutManager.hasLayoutChanged(settings.widgets.layout);
    const appearanceChanged = this.hasAppearanceChanged(settings);
    const pinnedTabsChanged = this.hasPinnedTabsChanged(settings);
    this.settings = settings;
    if (layoutChanged) {
      this.layoutManager.loadWidgetLayout(settings.widgets.layout);
    }
    this.configureSystemWatcher(settings.themeMode);
    if (appearanceChanged && !this.layoutManager.getPersistingLayout()) {
      this.refreshTheme();
    }
    this.updateSearch(settings);
    this.updateTagline(settings);
    this.updateClockVisibility(settings);
    if (pinnedTabsChanged) {
      this.updatePinnedTabs(settings);
    }
    if (this.display) {
      this.display.setSecondsVisible(Boolean(settings.clock.showSeconds));
    }
    this.updateWidgets(settings);
    this.render(true);
    // Track this settings state for next comparison
    this.previousSettings = cloneSettings(settings);
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
    this.tagline.classList.toggle("is-hidden", !settings.taglineEnabled);
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
      if (!isValidUrlScheme(tab.url)) return;
      const item = createElement<HTMLAnchorElement>("a", { className: "tabula-pinned__item" });
      item.href = tab.url;
      item.rel = "noopener noreferrer";
      item.title = tab.title;
      item.setAttribute("aria-label", tab.title);

      const iconWrapper = createElement("span", { className: "tabula-pinned__icon" });
      
      const showIcons = settings.pinnedTabsShowIcons;
      if (showIcons) {
        const rawIcon = tab.icon || getFaviconUrl(tab.url);
        const iconSrc = isValidUrlScheme(rawIcon) ? rawIcon : "";
        if (iconSrc) {
          const image = createElement<HTMLImageElement>("img", { className: "tabula-pinned__icon-image" });
          image.src = iconSrc;
          image.alt = "";
          image.loading = "lazy";
          image.onerror = () => {
            // Fallback to letter if image fails
            iconWrapper.replaceChildren();
            const fallback = createElement("span", { className: "tabula-pinned__icon-fallback" });
            fallback.textContent = tab.title.slice(0, 1).toUpperCase();
            iconWrapper.append(fallback);
          };
          iconWrapper.append(image);
        } else {
          const fallback = createElement("span", { className: "tabula-pinned__icon-fallback" });
          fallback.textContent = tab.title.slice(0, 1).toUpperCase();
          iconWrapper.append(fallback);
        }
      } else {
        const fallback = createElement("span", { className: "tabula-pinned__icon-fallback" });
        fallback.textContent = tab.title.slice(0, 1).toUpperCase();
        iconWrapper.append(fallback);
      }

      item.append(iconWrapper);
      fragment.appendChild(item);
    });

    this.pinnedList.appendChild(fragment);

    if (this.settings) {
      this.updateSearch(this.settings);
    }
  }

  private updateClockVisibility(settings: Settings): void {
    if (!this.clockContainer) return;
    this.clockContainer.classList.toggle("is-hidden", !settings.clock.enabled);
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
      // Firefox uses browser.* namespace, Chromium uses chrome.*
      const api =
        (typeof browser !== "undefined" && (browser as any)?.runtime)
          ? (browser as any)
          : (typeof chrome !== "undefined" ? chrome : null);

      if (api?.runtime?.openOptionsPage) {
        api.runtime.openOptionsPage();
        return;
      }
      if (api?.runtime?.getURL) {
        const url = api.runtime.getURL("options.html");
        window.open(url, "_blank", "noopener");
        return;
      }
    } catch (error) {
      console.warn("Failed to open options page via extension runtime", error);
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
    if (!this.widgetsContainer || !this.weatherWidget || !this.pomodoroWidget || !this.tasksWidget || !this.notesWidget || !this.quotesWidget) return;

    const { widgets } = settings;
    this.weatherWidget.update(widgets.weather);
    this.pomodoroWidget.update(widgets.pomodoro);
    this.tasksWidget.update(widgets.tasks);
    this.notesWidget.update(widgets.notes);
    this.quotesWidget.update(widgets.quotes);

    this.layoutManager.applyWidgetLayout();

    const allDisabled = !widgets.weather.enabled && !widgets.pomodoro.enabled && !widgets.tasks.enabled && !widgets.notes.enabled && !widgets.quotes.enabled;
    this.widgetsContainer.classList.toggle("is-hidden", allDisabled);
  }

  private hydrateFromCache(): void {
    try {
      const snapshot = getCachedSettingsSnapshot();
      this.onSettingsChanged(snapshot);
    } catch (error) {
      console.warn("Failed to hydrate settings snapshot", error);
    }
  }
}
