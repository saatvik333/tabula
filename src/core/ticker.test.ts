import { describe, expect, it, vi } from "vitest";

import { startAlignedSecondTicker } from "$src/core/ticker";

describe("startAlignedSecondTicker", () => {
  it("aligns the first tick to the next second boundary", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(new Date("2024-01-01T00:00:00.500Z").valueOf());
    const timeoutSpy = vi.spyOn(window, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");

    const tick = vi.fn();
    const stop = startAlignedSecondTicker(tick);

    expect(tick).not.toHaveBeenCalled();
    expect(timeoutSpy).toHaveBeenCalledTimes(1);

    const [timeoutCallback, timeoutDelay] = timeoutSpy.mock.calls[0] ?? [];
    expect(timeoutDelay).toBe(500);
    expect(typeof timeoutCallback).toBe("function");

    if (typeof timeoutCallback === "function") {
      timeoutCallback();
    }

    expect(tick).toHaveBeenCalledTimes(1);
    // Under recursive setTimeout, the timeout is called again to schedule the next tick
    expect(timeoutSpy).toHaveBeenCalledTimes(2);

    const [nextCallback, nextDelay] = timeoutSpy.mock.calls[1] ?? [];
    expect(nextDelay).toBe(500); // 1000 - (500 % 1000) = 500
    expect(typeof nextCallback).toBe("function");

    if (typeof nextCallback === "function") {
      nextCallback();
    }

    expect(tick).toHaveBeenCalledTimes(2);

    stop();
    expect(clearTimeoutSpy).toHaveBeenCalled();

    nowSpy.mockRestore();
    timeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });
});
