import { createElement } from "$src/core/dom";
import type { PomodoroWidgetSettings } from "$src/settings/schema";

type PomodoroMode = "focus" | "short-break" | "long-break";

type PomodoroState = {
  mode: PomodoroMode;
  remainingMs: number;
  running: boolean;
  cyclesCompleted: number;
  lastUpdated: number;
};

const STORAGE_KEY = "tabula:pomodoro-state";

const MODE_LABELS: Record<PomodoroMode, string> = {
  focus: "Focus",
  "short-break": "Short break",
  "long-break": "Long break",
};

const formatTime = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const minutesToMs = (minutes: number): number => minutes * 60 * 1000;

const loadState = (): PomodoroState | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PomodoroState;
    if (!parsed || typeof parsed.remainingMs !== "number") return null;
    return parsed;
  } catch (error) {
    console.warn("Failed to load pomodoro state", error);
    return null;
  }
};

const saveState = (state: PomodoroState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Failed to persist pomodoro state", error);
  }
};

class PomodoroWidget {
  private settings: PomodoroWidgetSettings = {
    enabled: true,
    focusMinutes: 25,
    breakMinutes: 5,
    longBreakMinutes: 15,
    cyclesBeforeLongBreak: 4,
  };

  private state: PomodoroState;

  private intervalId: number | null = null;

  readonly element: HTMLElement;

  private readonly modeEl: HTMLElement;
  private readonly timeEl: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly primaryButton: HTMLButtonElement;
  private readonly secondaryButton: HTMLButtonElement;
  private readonly skipButton: HTMLButtonElement;

  constructor() {
    this.element = createElement("div", { className: "tabula-widget tabula-widget--pomodoro" });

    this.modeEl = createElement("p", { className: "tabula-widget__title" });
    this.timeEl = createElement("p", { className: "tabula-widget__value tabula-widget__value--xl" });
    this.statusEl = createElement("p", { className: "tabula-widget__status" });

    const actions = createElement("div", { className: "tabula-widget__actions" });
    this.primaryButton = createElement<HTMLButtonElement>("button", { className: "tabula-widget__button tabula-widget__button--primary" });
    this.secondaryButton = createElement<HTMLButtonElement>("button", { className: "tabula-widget__button" });
    this.skipButton = createElement<HTMLButtonElement>("button", { className: "tabula-widget__button" });

    this.primaryButton.type = "button";
    this.secondaryButton.type = "button";
    this.skipButton.type = "button";

    this.primaryButton.textContent = "Start";
    this.secondaryButton.textContent = "Reset";
    this.skipButton.textContent = "Skip";

    this.primaryButton.addEventListener("click", () => this.toggleRunning());
    this.secondaryButton.addEventListener("click", () => this.reset());
    this.skipButton.addEventListener("click", () => this.skip());

    actions.append(this.primaryButton, this.secondaryButton, this.skipButton);
    this.element.append(this.modeEl, this.timeEl, actions, this.statusEl);

    this.state = this.restoreState();
    this.render();
    this.applyRunningState();
  }

  update(settings: PomodoroWidgetSettings): void {
    this.settings = settings;
    if (!settings.enabled) {
      this.element.hidden = true;
      this.stop();
      return;
    }

    this.element.hidden = false;

    const durations = this.getDurations();
    const currentDuration = durations[this.state.mode];
    if (this.state.remainingMs > currentDuration) {
      this.state.remainingMs = currentDuration;
    }

    this.render();
    this.applyRunningState();
  }

  destroy(): void {
    this.stop();
  }

  private restoreState(): PomodoroState {
    const stored = loadState();
    const durations = this.getDurations();
    if (stored) {
      const mode = stored.mode ?? "focus";
      const remainingMs = Math.min(stored.remainingMs ?? durations[mode], durations[mode]);
      const running = Boolean(stored.running);
      const cyclesCompleted = Number.isFinite(stored.cyclesCompleted) ? stored.cyclesCompleted : 0;
      const lastUpdated = Number.isFinite(stored.lastUpdated) ? stored.lastUpdated : Date.now();

      const state: PomodoroState = {
        mode,
        remainingMs,
        running,
        cyclesCompleted,
        lastUpdated,
      };

      if (running) {
        this.applyElapsedTime(state);
      }

      return state;
    }

    return {
      mode: "focus",
      remainingMs: durations.focus,
      running: false,
      cyclesCompleted: 0,
      lastUpdated: Date.now(),
    };
  }

  private applyElapsedTime(state: PomodoroState): void {
    const elapsed = Date.now() - state.lastUpdated;
    if (elapsed <= 0) return;
    state.remainingMs = Math.max(0, state.remainingMs - elapsed);
    if (state.remainingMs === 0) {
      this.advanceState(state);
    }
  }

  private getDurations(): Record<PomodoroMode, number> {
    return {
      focus: minutesToMs(this.settings.focusMinutes),
      "short-break": minutesToMs(this.settings.breakMinutes),
      "long-break": minutesToMs(this.settings.longBreakMinutes),
    };
  }

  private advanceState(state: PomodoroState): void {
    if (state.mode === "focus") {
      state.cyclesCompleted += 1;
      const useLongBreak = state.cyclesCompleted % this.settings.cyclesBeforeLongBreak === 0;
      state.mode = useLongBreak ? "long-break" : "short-break";
    } else {
      state.mode = "focus";
    }

    const durations = this.getDurations();
    state.remainingMs = durations[state.mode];
    state.lastUpdated = Date.now();
    state.running = true;
    saveState(state);
    this.render();
  }

  private tick(): void {
    const now = Date.now();
    const elapsed = now - this.state.lastUpdated;
    this.state.lastUpdated = now;
    this.state.remainingMs = Math.max(0, this.state.remainingMs - elapsed);

    if (this.state.remainingMs === 0) {
      this.advanceState(this.state);
      this.notifyModeChange();
    } else {
      saveState(this.state);
      this.render();
    }
  }

  private toggleRunning(): void {
    if (this.state.running) {
      this.pause();
    } else {
      this.start();
    }
  }

  private start(): void {
    if (this.intervalId !== null) return;
    this.state.running = true;
    this.state.lastUpdated = Date.now();
    this.intervalId = window.setInterval(() => this.tick(), 1000);
    saveState(this.state);
    this.render();
    this.applyRunningState();
  }

  private pause(): void {
    this.stop();
    this.state.running = false;
    saveState(this.state);
    this.render();
    this.applyRunningState();
  }

  private stop(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private reset(): void {
    const durations = this.getDurations();
    this.state = {
      mode: "focus",
      remainingMs: durations.focus,
      running: false,
      cyclesCompleted: 0,
      lastUpdated: Date.now(),
    };
    this.stop();
    saveState(this.state);
    this.render();
    this.applyRunningState();
  }

  private skip(): void {
    this.stop();
    this.state.running = false;
    if (this.state.mode === "focus") {
      this.state.cyclesCompleted += 1;
      const useLongBreak = this.state.cyclesCompleted % this.settings.cyclesBeforeLongBreak === 0;
      this.state.mode = useLongBreak ? "long-break" : "short-break";
    } else {
      this.state.mode = "focus";
    }
    this.state.remainingMs = this.getDurations()[this.state.mode];
    this.state.lastUpdated = Date.now();
    saveState(this.state);
    this.render();
    this.applyRunningState();
  }

  private applyRunningState(): void {
    if (this.state.running) {
      this.primaryButton.textContent = "Pause";
      this.primaryButton.classList.add("is-active");
    } else {
      this.primaryButton.textContent = "Start";
      this.primaryButton.classList.remove("is-active");
    }
    this.skipButton.disabled = this.state.mode === "focus" && !this.state.running;
  }

  private render(): void {
    this.modeEl.textContent = MODE_LABELS[this.state.mode];
    this.timeEl.textContent = formatTime(this.state.remainingMs);
    const sessionsLabel = this.state.cyclesCompleted === 1 ? "session" : "sessions";
    this.statusEl.textContent = `${this.state.cyclesCompleted} focus ${sessionsLabel} completed`;
  }

  private notifyModeChange(): void {
    this.statusEl.textContent = `${MODE_LABELS[this.state.mode]} started`;
  }
}

export type PomodoroWidgetController = {
  element: HTMLElement;
  update: (settings: PomodoroWidgetSettings) => void;
  destroy: () => void;
};

export const createPomodoroWidget = (): PomodoroWidgetController => {
  const widget = new PomodoroWidget();
  return {
    element: widget.element,
    update: (settings) => widget.update(settings),
    destroy: () => widget.destroy(),
  };
};
