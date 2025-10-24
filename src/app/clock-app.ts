import { createClockDisplay, type ClockDisplay } from "$src/clock/clock-display";
import { createElement } from "$src/core/dom";
import { startAlignedSecondTicker, type StopTicker } from "$src/core/ticker";
import { formatTimeForDisplay, getCurrentTime, timesEqual, type Meridiem, type Time } from "$src/core/time";
import { applySettingsToDocument } from "$src/settings/apply";
import type {
  PinnedTab,
  SearchEngine,
  Settings,
  TaskItem,
  WidgetId,
  WidgetAnchor,
  WidgetLayoutEntry,
} from "$src/settings/schema";
import {
  getCachedSettingsSnapshot,
  loadSettings,
  subscribeToSettings,
  updateSettings,
} from "$src/settings/storage";
import { getSystemPrefersDark, resolveTheme, watchSystemTheme, type ThemeVariant } from "$src/settings/theme";
import { createWeatherWidget, type WeatherWidgetController } from "$src/widgets/weather-widget";
import { createPomodoroWidget, type PomodoroWidgetController } from "$src/widgets/pomodoro-widget";
import { createTasksWidget, type TasksWidgetController } from "$src/widgets/tasks-widget";

type TimeSource = () => Time;

type TickerFactory = (tick: () => void) => StopTicker;

const SEARCH_ENGINES: Record<SearchEngine, (query: string) => string> = {
  google: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  bing: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
  duckduckgo: (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
  brave: (query) => `https://search.brave.com/search?q=${encodeURIComponent(query)}`,
};

const WIDGET_IDS: WidgetId[] = ["weather", "pomodoro", "tasks"];

type WidgetPosition = {
  x: number;
  y: number;
  anchor?: WidgetAnchor;
};

const EDGE_ANCHOR_THRESHOLD = 32;

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
  private tasksWidget: TasksWidgetController | null = null;

  private widgetElements: Partial<Record<WidgetId, HTMLElement>> = {};

  private widgetLayout = new Map<WidgetId, WidgetPosition>();

  private activeDrag: {
    id: WidgetId;
    element: HTMLElement;
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null = null;

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.activeDrag || event.pointerId !== this.activeDrag.pointerId) {
      return;
    }

    const deltaX = event.clientX - this.activeDrag.startX;
    const deltaY = event.clientY - this.activeDrag.startY;
    const nextX = this.activeDrag.originX + deltaX;
    const nextY = this.activeDrag.originY + deltaY;
    this.applyWidgetPosition(this.activeDrag.id, this.activeDrag.element, nextX, nextY, { updateLayout: true });
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (!this.activeDrag || event.pointerId !== this.activeDrag.pointerId) {
      return;
    }

    const { element, pointerId, id } = this.activeDrag;
    const coords = this.widgetLayout.get(id);
    if (coords) {
      this.applyWidgetPosition(id, element, coords.x, coords.y, { updateLayout: true });
    }
    element.releasePointerCapture(pointerId);
    element.classList.remove("is-dragging");
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerup", this.handlePointerUp);
    window.removeEventListener("pointercancel", this.handlePointerUp);

    this.activeDrag = null;
    void this.persistWidgetLayout();
  };

  private readonly handleWindowResize = (): void => {
    if (!this.settings) {
      return;
    }
    this.reapplyWidgetLayout();
  };

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
    this.hydrateFromCache();
    this.render(true);
    this.stopTicker = this.tickerFactory(() => this.render());
    window.addEventListener("resize", this.handleWindowResize);

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

    window.removeEventListener("resize", this.handleWindowResize);

    if (this.activeDrag) {
      this.activeDrag.element.classList.remove("is-dragging");
      this.activeDrag = null;
      window.removeEventListener("pointermove", this.handlePointerMove);
      window.removeEventListener("pointerup", this.handlePointerUp);
      window.removeEventListener("pointercancel", this.handlePointerUp);
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
    if (this.tasksWidget) {
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
    const tasksWidget = createTasksWidget({
      onChange: (items) => this.handleTasksChange(items),
    });
    this.prepareWidget(weatherWidget.element, "weather");
    this.prepareWidget(pomodoroWidget.element, "pomodoro");
    this.prepareWidget(tasksWidget.element, "tasks");
    widgetsContainer.append(weatherWidget.element, pomodoroWidget.element, tasksWidget.element);

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

    this.initializeDefaultWidgetLayout();
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

  private prepareWidget(element: HTMLElement, id: WidgetId): void {
    element.dataset["widgetId"] = id;
    this.widgetElements[id] = element;
    element.classList.add("tabula-widget--initial");
    element.addEventListener("pointerdown", (event) => this.beginWidgetDrag(id, element, event));
  }

  private initializeDefaultWidgetLayout(): void {
    const padding = Math.max(24, Math.min(48, window.innerWidth * 0.06));
    let cursorY = padding;

    for (const id of WIDGET_IDS) {
      const element = this.widgetElements[id];
      if (!element) {
        continue;
      }

      const { width, height } = this.getWidgetDimensions(element);
      const x = Math.max(padding, window.innerWidth - width - padding);
      const y = cursorY;
      cursorY = y + height + 20;

      const anchor: WidgetAnchor = {
        horizontal: "right",
        offsetX: Math.max(0, Math.round(window.innerWidth - (x + width))),
        vertical: "top",
        offsetY: Math.max(0, Math.round(y)),
      };

      this.applyWidgetPosition(id, element, x, y, { updateLayout: true, anchor });
    }
  }

  private getWidgetDimensions(element: HTMLElement | null | undefined): { width: number; height: number } {
    if (!element) {
      return { width: 300, height: 200 };
    }
    // Prefer offsetWidth/offsetHeight so CSS transforms (e.g., drag scale) don't skew measurements
    const width = element.offsetWidth || element.getBoundingClientRect().width || 300;
    const height = element.offsetHeight || element.getBoundingClientRect().height || 200;
    return { width, height };
  }

  private getLayoutBounds(): { left: number; right: number; top: number; bottom: number } {
    return {
      left: 0,
      right: window.innerWidth,
      top: 0,
      bottom: window.innerHeight,
    };
  }

  private beginWidgetDrag(id: WidgetId, element: HTMLElement, event: PointerEvent): void {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, select, textarea")) {
      return;
    }

    this.ensureLayoutEntries();

    const existing = this.widgetLayout.get(id);
    const origin = existing ? { x: existing.x, y: existing.y } : this.computePositionFromElement(element);
    const { x, y } = origin;
    this.widgetLayout.set(id, { x, y });

    this.activeDrag = {
      id,
      element,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: x,
      originY: y,
    };

    element.classList.add("is-dragging");
    element.setPointerCapture(event.pointerId);
    window.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("pointercancel", this.handlePointerUp);
    event.preventDefault();
  }

  private computePositionFromElement(element: HTMLElement): WidgetPosition {
    const rect = element.getBoundingClientRect();
    const { x, y } = this.clampPosition(element, rect.left, rect.top);
    return { x, y };
  }

  private clampPosition(element: HTMLElement, x: number, y: number): { x: number; y: number } {
    const bounds = this.getLayoutBounds();
    const padding = 16;
    const measured = element.getBoundingClientRect();
    const width = element.offsetWidth || measured.width || 280;
    const height = element.offsetHeight || measured.height || 180;
    const minX = bounds.left + padding;
    const maxX = bounds.right - width - padding;
    const minY = bounds.top + padding;
    const maxY = bounds.bottom - height - padding;
    const clampedX = Math.min(maxX, Math.max(minX, x));
    const clampedY = Math.min(maxY, Math.max(minY, y));
    return { x: clampedX, y: clampedY };
  }

  private cloneAnchor(anchor?: WidgetAnchor | null): WidgetAnchor | undefined {
    if (!anchor) {
      return undefined;
    }

    const clone: WidgetAnchor = {};

    if (anchor.horizontal === "left" || anchor.horizontal === "right") {
      clone.horizontal = anchor.horizontal;
      const offset = this.normaliseOffset(anchor.offsetX);
      if (typeof offset === "number") {
        clone.offsetX = offset;
      }
    }

    if (anchor.vertical === "top" || anchor.vertical === "bottom") {
      clone.vertical = anchor.vertical;
      const offset = this.normaliseOffset(anchor.offsetY);
      if (typeof offset === "number") {
        clone.offsetY = offset;
      }
    }

    return Object.keys(clone).length ? clone : undefined;
  }

  private normaliseOffset(value: unknown): number | undefined {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return undefined;
    }
    return Math.round(numeric * 100) / 100;
  }

  private formatPx(value: number): string {
    const normalised = Math.round(value * 100) / 100;
    if (Math.abs(normalised % 1) < 0.01) {
      return `${Math.round(normalised)}px`;
    }
    return `${normalised.toFixed(2)}px`;
  }

  private resolveAnchoredCoordinates(
    element: HTMLElement,
    anchor: WidgetAnchor,
    fallbackX: number,
    fallbackY: number,
  ): { x: number; y: number } {
    const { width, height } = this.getWidgetDimensions(element);
    let x = fallbackX;
    let y = fallbackY;

    if (anchor.horizontal === "right") {
      const offset = typeof anchor.offsetX === "number" && Number.isFinite(anchor.offsetX)
        ? anchor.offsetX
        : Math.max(0, window.innerWidth - (fallbackX + width));
      x = Math.max(0, window.innerWidth - width - offset);
    } else if (anchor.horizontal === "left") {
      const offset = typeof anchor.offsetX === "number" && Number.isFinite(anchor.offsetX)
        ? anchor.offsetX
        : fallbackX;
      x = Math.max(0, offset);
    }

    if (anchor.vertical === "bottom") {
      const offset = typeof anchor.offsetY === "number" && Number.isFinite(anchor.offsetY)
        ? anchor.offsetY
        : Math.max(0, window.innerHeight - (fallbackY + height));
      y = Math.max(0, window.innerHeight - height - offset);
    } else if (anchor.vertical === "top") {
      const offset = typeof anchor.offsetY === "number" && Number.isFinite(anchor.offsetY)
        ? anchor.offsetY
        : fallbackY;
      y = Math.max(0, offset);
    }

    return { x, y };
  }

  private setElementStyle(element: HTMLElement, position: WidgetPosition): void {
    const { anchor } = position;
    const { width, height } = this.getWidgetDimensions(element);

    if (anchor?.horizontal === "right") {
      const fallbackOffset = Math.max(0, window.innerWidth - (position.x + width));
      const offset = this.normaliseOffset(anchor.offsetX ?? fallbackOffset) ?? fallbackOffset;
      element.style.right = this.formatPx(offset);
      element.style.left = "";
    } else {
      element.style.left = this.formatPx(position.x);
      element.style.right = "";
    }

    if (anchor?.vertical === "bottom") {
      const fallbackOffset = Math.max(0, window.innerHeight - (position.y + height));
      const offset = this.normaliseOffset(anchor.offsetY ?? fallbackOffset) ?? fallbackOffset;
      element.style.bottom = this.formatPx(offset);
      element.style.top = "";
    } else {
      element.style.top = this.formatPx(position.y);
      element.style.bottom = "";
    }

    element.style.transform = "";
  }

  private deriveAnchorFromPosition(element: HTMLElement, position: WidgetPosition): WidgetAnchor | undefined {
    const { width, height } = this.getWidgetDimensions(element);
    if (width <= 0 || height <= 0) {
      return undefined;
    }

    const distanceLeft = Math.max(0, position.x);
    const distanceRight = Math.max(0, window.innerWidth - (position.x + width));
    const distanceTop = Math.max(0, position.y);
    const distanceBottom = Math.max(0, window.innerHeight - (position.y + height));

    let horizontal: WidgetAnchor["horizontal"];
    if (distanceLeft <= EDGE_ANCHOR_THRESHOLD || distanceRight <= EDGE_ANCHOR_THRESHOLD) {
      horizontal = distanceLeft <= distanceRight ? "left" : "right";
    }

    let vertical: WidgetAnchor["vertical"];
    if (distanceTop <= EDGE_ANCHOR_THRESHOLD || distanceBottom <= EDGE_ANCHOR_THRESHOLD) {
      vertical = distanceTop <= distanceBottom ? "top" : "bottom";
    }

    if (!horizontal && !vertical) {
      return undefined;
    }

    const anchor: WidgetAnchor = {};
    if (horizontal) {
      anchor.horizontal = horizontal;
      const offset = this.normaliseOffset(horizontal === "left" ? distanceLeft : distanceRight);
      if (typeof offset === "number") {
        anchor.offsetX = offset;
      }
    }
    if (vertical) {
      anchor.vertical = vertical;
      const offset = this.normaliseOffset(vertical === "top" ? distanceTop : distanceBottom);
      if (typeof offset === "number") {
        anchor.offsetY = offset;
      }
    }

    return anchor;
  }

  private applyWidgetPosition(
    id: WidgetId,
    element: HTMLElement,
    x: number,
    y: number,
    options: { updateLayout?: boolean; anchor?: WidgetAnchor | null } = {},
  ): void {
    const { updateLayout = false, anchor = undefined } = options;
    const usableAnchor = this.cloneAnchor(anchor ?? undefined);
    const resolved = usableAnchor
      ? this.resolveAnchoredCoordinates(element, usableAnchor, x, y)
      : { x, y };

    const clampedFallback = this.clampPosition(element, resolved.x, resolved.y);
    const clampedX = usableAnchor?.horizontal ? resolved.x : clampedFallback.x;
    const clampedY = usableAnchor?.vertical ? resolved.y : clampedFallback.y;
    const position: WidgetPosition = {
      x: usableAnchor?.horizontal ? clampedX : Math.round(clampedX),
      y: usableAnchor?.vertical ? clampedY : Math.round(clampedY),
      ...(usableAnchor ? { anchor: usableAnchor } : {}),
    };

    this.setElementStyle(element, position);

    if (updateLayout) {
      this.widgetLayout.set(id, {
        x: position.x,
        y: position.y,
        ...(position.anchor ? { anchor: this.cloneAnchor(position.anchor) } : {}),
      });
    }
    if (element.classList.contains("tabula-widget--initial") && this.settings) {
      requestAnimationFrame(() => {
        element.classList.remove("tabula-widget--initial");
      });
    }
  }

  private loadWidgetLayout(layout: WidgetLayoutEntry[]): void {
    this.widgetLayout.clear();
    layout.forEach((entry) => {
      const anchor = this.cloneAnchor(entry.anchor);
      this.widgetLayout.set(entry.id, {
        x: entry.x,
        y: entry.y,
        ...(anchor ? { anchor } : {}),
      });
    });
    this.ensureLayoutEntries();
  }

  private ensureLayoutEntries(): void {
    const bounds = this.getLayoutBounds();
    const padding = Math.max(24, Math.min(48, window.innerWidth * 0.06));
    let cursorY = bounds.top + padding;

    for (const id of WIDGET_IDS) {
      const element = this.widgetElements[id] ?? null;
      const { width, height } = this.getWidgetDimensions(element);

      if (this.widgetLayout.has(id)) {
        const existing = this.widgetLayout.get(id)!;
        const needsDefault =
          !Number.isFinite(existing.x) ||
          !Number.isFinite(existing.y);

        if (needsDefault) {
          const defaultX = Math.max(bounds.left + padding, bounds.right - width - padding);
          const defaultY = cursorY;
          cursorY = defaultY + height + 20;
          const anchor: WidgetAnchor = {
            horizontal: "right",
            offsetX: Math.max(0, Math.round(bounds.right - (defaultX + width))),
            vertical: "top",
            offsetY: Math.max(0, Math.round(defaultY - bounds.top)),
          };
          this.widgetLayout.set(id, { x: defaultX, y: defaultY, anchor });
        } else {
          const resolved = existing.anchor && element
            ? this.resolveAnchoredCoordinates(element, existing.anchor, existing.x, existing.y)
            : { x: existing.x, y: existing.y };
          const clamped = element ? this.clampPosition(element, resolved.x, resolved.y) : resolved;
          this.widgetLayout.set(id, {
            x: clamped.x,
            y: clamped.y,
            ...(existing.anchor ? { anchor: this.cloneAnchor(existing.anchor) } : {}),
          });
          cursorY = Math.max(cursorY, clamped.y + height + 20);
        }
        continue;
      }

      const x = Math.max(bounds.left + padding, bounds.right - width - padding);
      const y = cursorY;
      cursorY = y + height + 20;
      const anchor: WidgetAnchor = {
        horizontal: "right",
        offsetX: Math.max(0, Math.round(bounds.right - (x + width))),
        vertical: "top",
        offsetY: Math.max(0, Math.round(y - bounds.top)),
      };
      this.widgetLayout.set(id, { x, y, anchor });
    }
  }

  private reapplyWidgetLayout(): void {
    this.ensureLayoutEntries();
    this.applyWidgetLayout();
  }

  private serializeWidgetLayout(): WidgetLayoutEntry[] {
    const result: WidgetLayoutEntry[] = [];
    for (const id of WIDGET_IDS) {
      const coords = this.widgetLayout.get(id);
      if (!coords) {
        continue;
      }
      const entry: WidgetLayoutEntry = {
        id,
        x: Math.round(coords.x),
        y: Math.round(coords.y),
      };
      const anchor = this.cloneAnchor(coords.anchor);
      if (anchor) {
        entry.anchor = anchor;
      }
      result.push(entry);
    }
    return result;
  }

  private async persistWidgetLayout(): Promise<void> {
    if (!this.settings) {
      return;
    }

    for (const id of WIDGET_IDS) {
      const element = this.widgetElements[id];
      const coords = this.widgetLayout.get(id);
      if (!element || !coords) {
        continue;
      }
      const anchor = this.deriveAnchorFromPosition(element, coords);
      if (anchor) {
        coords.anchor = this.cloneAnchor(anchor);
      } else {
        delete coords.anchor;
      }
      this.widgetLayout.set(id, {
        x: coords.x,
        y: coords.y,
        ...(coords.anchor ? { anchor: this.cloneAnchor(coords.anchor) } : {}),
      });
    }

    const layout = this.serializeWidgetLayout();

    const currentLayout = this.settings.widgets.layout;
    const layoutChanged =
      layout.length !== currentLayout.length ||
      layout.some((entry, index) => {
        const current = currentLayout[index];
        if (!current) {
          return true;
        }
        if (current.id !== entry.id || current.x !== entry.x || current.y !== entry.y) {
          return true;
        }
        const nextAnchor = entry.anchor ?? undefined;
        const currentAnchor = current.anchor ?? undefined;
        if (!currentAnchor && !nextAnchor) {
          return false;
        }
        if (!currentAnchor || !nextAnchor) {
          return true;
        }
        const sameHorizontal = currentAnchor.horizontal === nextAnchor.horizontal;
        const sameVertical = currentAnchor.vertical === nextAnchor.vertical;
        const sameOffsetX = Math.round(currentAnchor.offsetX ?? -1) === Math.round(nextAnchor.offsetX ?? -1);
        const sameOffsetY = Math.round(currentAnchor.offsetY ?? -1) === Math.round(nextAnchor.offsetY ?? -1);
        return !(sameHorizontal && sameVertical && sameOffsetX && sameOffsetY);
      });

    if (!layoutChanged) {
      return;
    }

    const widgets = {
      ...this.settings.widgets,
      layout,
    };

    this.settings = {
      ...this.settings,
      widgets,
    };

    try {
      await updateSettings({
        widgets: {
          layout,
          weather: widgets.weather,
          pomodoro: widgets.pomodoro,
        },
      });
    } catch (error) {
      console.warn("Failed to persist widget layout", error);
    }
  }

  private applyWidgetLayout(): void {
    if (!this.settings) {
      return;
    }
    this.ensureLayoutEntries();
    for (const id of WIDGET_IDS) {
      const element = this.widgetElements[id];
      if (!element) {
        continue;
      }
      const coords = this.widgetLayout.get(id);
      if (!coords) {
        continue;
      }
      this.applyWidgetPosition(id, element, coords.x, coords.y, {
        updateLayout: true,
        anchor: this.cloneAnchor(coords.anchor),
      });
    }
  }

  private onSettingsChanged(settings: Settings): void {
    this.settings = settings;
    this.loadWidgetLayout(settings.widgets.layout);
    this.configureSystemWatcher(settings.themeMode);
    this.refreshTheme();
    this.updateSearch(settings);
    this.updateTagline(settings);
    this.updatePinnedTabs(settings);
    if (this.display) {
      this.display.setSecondsVisible(Boolean(settings.clock.showSeconds));
    }
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
      const item = createElement<HTMLAnchorElement>("a", { className: "tabula-pinned__item tabula-card tabula-card--subtle" });
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
    if (!this.widgetsContainer || !this.weatherWidget || !this.pomodoroWidget || !this.tasksWidget) return;

    const { widgets } = settings;
    this.weatherWidget.update(widgets.weather);
    this.pomodoroWidget.update(widgets.pomodoro);
    this.tasksWidget.update(widgets.tasks);

    this.applyWidgetLayout();

    const allDisabled = !widgets.weather.enabled && !widgets.pomodoro.enabled && !widgets.tasks.enabled;
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
