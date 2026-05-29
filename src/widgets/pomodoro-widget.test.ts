import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createPomodoroWidget } from "./pomodoro-widget";

describe("createPomodoroWidget", () => {
  let widget: ReturnType<typeof createPomodoroWidget>;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (widget && typeof widget.destroy === "function") {
      widget.destroy();
    }
  });

  it("creates widget element with correct sub-elements", () => {
    widget = createPomodoroWidget();
    expect(widget.element).toBeDefined();
    expect(widget.element.classList.contains("tabula-widget--pomodoro")).toBe(true);

    const modeEl = widget.element.querySelector(".tabula-widget__title");
    const timeEl = widget.element.querySelector(".tabula-widget__value");
    const primaryButton = widget.element.querySelector(".tabula-button--primary");
    const secondaryButton = widget.element.querySelectorAll(".tabula-button--ghost")[0];
    const skipButton = widget.element.querySelectorAll(".tabula-button--ghost")[1];

    expect(modeEl).toBeDefined();
    expect(timeEl?.textContent).toBe("25:00");
    expect(primaryButton?.textContent).toBe("Start");
    expect(secondaryButton?.textContent).toBe("Reset");
    expect(skipButton?.textContent).toBe("Skip");
  });

  it("toggles timer running state on primary button click", () => {
    widget = createPomodoroWidget();
    const primaryButton = widget.element.querySelector(".tabula-button--primary") as HTMLButtonElement;

    expect(primaryButton.textContent).toBe("Start");

    // Click Start
    primaryButton.click();
    expect(primaryButton.textContent).toBe("Pause");

    // Click Pause
    primaryButton.click();
    expect(primaryButton.textContent).toBe("Start");
  });

  it("ticking down updates the displayed time and state", () => {
    widget = createPomodoroWidget();
    const primaryButton = widget.element.querySelector(".tabula-button--primary") as HTMLButtonElement;
    const timeEl = widget.element.querySelector(".tabula-widget__value");

    primaryButton.click(); // Start

    // Advance time by 5 seconds
    vi.advanceTimersByTime(5000);

    expect(timeEl?.textContent).toBe("24:55");
  });

  it("skips and transitions modes correctly", () => {
    widget = createPomodoroWidget();
    const primaryButton = widget.element.querySelector(".tabula-button--primary") as HTMLButtonElement;
    const modeEl = widget.element.querySelector(".tabula-widget__title");
    const timeEl = widget.element.querySelector(".tabula-widget__value");
    const skipButton = widget.element.querySelectorAll(".tabula-button--ghost")[1] as HTMLButtonElement;

    expect(modeEl?.textContent).toBe("Focus");
    expect(timeEl?.textContent).toBe("25:00");

    // Start timer to enable skip
    primaryButton.click();

    // Skip to Short Break
    skipButton.click();
    expect(modeEl?.textContent).toBe("Short break");
    expect(timeEl?.textContent).toBe("05:00");

    // Start break timer to enable skip
    primaryButton.click();

    // Skip to Focus
    skipButton.click();
    expect(modeEl?.textContent).toBe("Focus");
  });

  it("resets back to focus session", () => {
    widget = createPomodoroWidget();
    const primaryButton = widget.element.querySelector(".tabula-button--primary") as HTMLButtonElement;
    const secondaryButton = widget.element.querySelectorAll(".tabula-button--ghost")[0] as HTMLButtonElement;
    const timeEl = widget.element.querySelector(".tabula-widget__value");

    primaryButton.click(); // Start
    vi.advanceTimersByTime(10000);

    expect(timeEl?.textContent).toBe("24:50");

    // Reset
    secondaryButton.click();
    expect(timeEl?.textContent).toBe("25:00");
    expect(primaryButton.textContent).toBe("Start");
  });

  it("syncs state from external changes via storage event", () => {
    widget = createPomodoroWidget();
    const timeEl = widget.element.querySelector(".tabula-widget__value");

    const newState = {
      mode: "focus" as const,
      remainingMs: 1200000, // 20 minutes
      running: false,
      cyclesCompleted: 0,
      lastUpdated: Date.now(),
    };

    // Simulate storage event
    const storageEvent = new StorageEvent("storage", {
      key: "tabula:pomodoro-state",
      newValue: JSON.stringify(newState),
    });
    window.dispatchEvent(storageEvent);

    expect(timeEl?.textContent).toBe("20:00");
  });
});
