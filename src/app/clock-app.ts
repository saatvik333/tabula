import { createClockDisplay, type ClockDisplay } from "$src/clock/clock-display";
import { startAlignedSecondTicker, type StopTicker } from "$src/core/ticker";
import { getCurrentTime, timesEqual, type Time } from "$src/core/time";

type TimeSource = () => Time;

type TickerFactory = (tick: () => void) => StopTicker;

export class ClockApp {
  private readonly timeSource: TimeSource;

  private readonly tickerFactory: TickerFactory;

  private display: ClockDisplay | null = null;

  private stopTicker: StopTicker | null = null;

  private currentTime: Time | null = null;

  constructor(
    private readonly container: HTMLElement,
    timeSource: TimeSource = getCurrentTime,
    tickerFactory: TickerFactory = startAlignedSecondTicker,
  ) {
    this.timeSource = timeSource;
    this.tickerFactory = tickerFactory;
  }

  start(): void {
    this.display = createClockDisplay();
    this.container.replaceChildren(this.display.element);
    this.render(true);
    this.stopTicker = this.tickerFactory(() => this.render());
  }

  stop(): void {
    if (this.stopTicker) {
      this.stopTicker();
      this.stopTicker = null;
    }
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
