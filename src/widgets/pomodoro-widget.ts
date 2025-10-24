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
const CHANNEL_NAME = "tabula:pomodoro-broadcast";

type PomodoroBroadcastMessage = {
  type: "state";
  state: PomodoroState;
  source: string;
};

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

  private readonly instanceId = Math.random().toString(36).slice(2);

  private channel: BroadcastChannel | null = null;

  private readonly handleStorage = (event: StorageEvent): void => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const parsed = JSON.parse(event.newValue) as PomodoroState;
      this.syncExternalState(parsed);
    } catch (error) {
      console.warn("Pomodoro widget storage sync failed", error);
    }
  };

  private readonly handleChannel = (event: MessageEvent<PomodoroBroadcastMessage>): void => {
    const payload = event.data;
    if (!payload || payload.type !== "state" || payload.source === this.instanceId) return;
    this.syncExternalState(payload.state);
  };

  readonly element: HTMLElement;

  private readonly modeEl: HTMLElement;
  private readonly timeEl: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly primaryButton: HTMLButtonElement;
  private readonly secondaryButton: HTMLButtonElement;
  private readonly skipButton: HTMLButtonElement;

  constructor() {
    this.element = createElement("div", { className: "tabula-card tabula-widget tabula-widget--pomodoro" });

    this.modeEl = createElement("p", { className: "tabula-widget__title" });
    this.timeEl = createElement("p", { className: "tabula-widget__value tabula-widget__value--xl" });
    this.statusEl = createElement("p", { className: "tabula-widget__status" });

    const actions = createElement("div", { className: "tabula-widget__actions" });
    this.primaryButton = createElement<HTMLButtonElement>("button", {
      className: "tabula-button tabula-button--primary",
    });
    this.secondaryButton = createElement<HTMLButtonElement>("button", {
      className: "tabula-button tabula-button--ghost",
    });
    this.skipButton = createElement<HTMLButtonElement>("button", {
      className: "tabula-button tabula-button--ghost",
    });

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
    if (!this.settings.enabled) {
      this.element.hidden = true;
      this.element.style.display = "none";
    }

    if (typeof BroadcastChannel !== "undefined") {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.addEventListener("message", this.handleChannel);
      } catch (error) {
        console.warn("Pomodoro widget broadcast channel unavailable", error);
        this.channel = null;
      }
    }

    window.addEventListener("storage", this.handleStorage);
  }

  update(settings: PomodoroWidgetSettings): void {
    this.settings = settings;
    if (!settings.enabled) {
      this.element.hidden = true;
      this.element.style.display = "none";
      this.stop();
      return;
    }

    this.element.hidden = false;
    this.element.style.display = "";

    const durations = this.getDurations();
    const currentDuration = durations[this.state.mode];
    if (this.state.remainingMs > currentDuration) {
      this.state.remainingMs = currentDuration;
    }

    if (this.state.running) {
      this.ensureInterval();
    } else {
      this.stop();
    }

    this.render();
    this.applyRunningState();
  }

  private syncExternalState(external: PomodoroState): void {
    const next = this.normalizeStateFromSource(external);
    this.state = next;

    if (!this.settings.enabled) {
      this.stop();
      this.render();
      this.applyRunningState();
      return;
    }

    if (this.state.running) {
      this.ensureInterval();
    } else {
      this.stop();
    }

    this.applyRunningState();
    this.render();
  }

  destroy(): void {
    this.stop();
    window.removeEventListener("storage", this.handleStorage);
    if (this.channel) {
      this.channel.removeEventListener("message", this.handleChannel);
      try {
        this.channel.close();
      } catch (error) {
        console.warn("Pomodoro widget broadcast channel close failed", error);
      }
      this.channel = null;
    }
  }

  private ensureInterval(): void {
    if (this.intervalId !== null) return;
    this.intervalId = window.setInterval(() => this.tick(), 1000);
  }

  private broadcastState(state: PomodoroState): void {
    if (!this.channel) return;
    try {
      const message: PomodoroBroadcastMessage = { type: "state", state, source: this.instanceId };
      this.channel.postMessage(message);
    } catch (error) {
      console.warn("Pomodoro widget broadcast failed", error);
    }
  }

  private persistState(state: PomodoroState): void {
    saveState(state);
    this.broadcastState(state);
  }

  private normalizeStateFromSource(source: PomodoroState | null): PomodoroState {
    const durations = this.getDurations();
    if (!source) {
      return {
        mode: "focus",
        remainingMs: durations.focus,
        running: false,
        cyclesCompleted: 0,
        lastUpdated: Date.now(),
      };
    }

    const mode: PomodoroMode = source.mode === "short-break" || source.mode === "long-break" ? source.mode : "focus";
    const cyclesCompleted = Number.isFinite(source.cyclesCompleted) ? Math.max(0, Math.floor(source.cyclesCompleted)) : 0;
    const running = Boolean(source.running);
    const remainingMsRaw = Number.isFinite(source.remainingMs) ? Math.max(0, source.remainingMs) : durations[mode];
    const lastUpdated = Number.isFinite(source.lastUpdated) ? source.lastUpdated : Date.now();

    const state: PomodoroState = {
      mode,
      remainingMs: Math.min(remainingMsRaw, durations[mode]),
      running,
      cyclesCompleted,
      lastUpdated,
    };

    if (state.running) {
      this.fastForward(state, Date.now() - state.lastUpdated);
    } else {
      if (state.remainingMs === 0 || state.remainingMs > durations[state.mode]) {
        state.remainingMs = durations[state.mode];
      }
      state.lastUpdated = Date.now();
    }

    return state;
  }

  private fastForward(state: PomodoroState, elapsedMs: number): void {
    if (elapsedMs <= 0) return;
    let remaining = elapsedMs;
    if (state.remainingMs <= 0) {
      this.transitionToNextPhase(state, { updateTimestamp: false, keepRunning: true });
    }
    while (remaining >= state.remainingMs) {
      remaining -= state.remainingMs;
      this.transitionToNextPhase(state, { updateTimestamp: false, keepRunning: true });
    }
    state.remainingMs = Math.max(0, state.remainingMs - remaining);
    state.lastUpdated = Date.now();
  }

  private transitionToNextPhase(
    state: PomodoroState,
    options: { keepRunning?: boolean; updateTimestamp?: boolean } = {},
  ): void {
    const { keepRunning = true, updateTimestamp = true } = options;
    if (state.mode === "focus") {
      state.cyclesCompleted += 1;
      const useLongBreak = state.cyclesCompleted % this.settings.cyclesBeforeLongBreak === 0;
      state.mode = useLongBreak ? "long-break" : "short-break";
    } else {
      state.mode = "focus";
    }

    const durations = this.getDurations();
    state.remainingMs = durations[state.mode];
    if (updateTimestamp) {
      state.lastUpdated = Date.now();
    }
    state.running = keepRunning;
  }

  private restoreState(): PomodoroState {
    return this.normalizeStateFromSource(loadState());
  }

  private getDurations(): Record<PomodoroMode, number> {
    return {
      focus: minutesToMs(this.settings.focusMinutes),
      "short-break": minutesToMs(this.settings.breakMinutes),
      "long-break": minutesToMs(this.settings.longBreakMinutes),
    };
  }

  private advanceState(state: PomodoroState, persist = true): void {
    this.transitionToNextPhase(state);
    if (persist) {
      this.persistState(state);
      this.render();
    }
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
      this.persistState(this.state);
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
    this.ensureInterval();
    this.persistState(this.state);
    this.render();
    this.applyRunningState();
  }

  private pause(): void {
    this.stop();
    this.state.running = false;
    this.persistState(this.state);
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
    this.persistState(this.state);
    this.render();
    this.applyRunningState();
  }

  private skip(): void {
    this.stop();
    this.transitionToNextPhase(this.state, { keepRunning: false });
    this.persistState(this.state);
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
