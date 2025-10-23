import { describe, expect, it, vi } from "vitest";

import { startAlignedSecondTicker } from "$src/core/ticker";

describe("startAlignedSecondTicker", () => {
  it("aligns the first tick to the next second boundary", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(new Date("2024-01-01T00:00:00.500Z").valueOf());
    const timeoutSpy = vi.spyOn(window, "setTimeout");
    const intervalSpy = vi.spyOn(window, "setInterval");
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");

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
    expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

    const [intervalCallback] = intervalSpy.mock.calls[0] ?? [];
    if (typeof intervalCallback === "function") {
      intervalCallback();
    }

    expect(tick).toHaveBeenCalledTimes(2);

    stop();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(clearIntervalSpy).toHaveBeenCalled();

    nowSpy.mockRestore();
    timeoutSpy.mockRestore();
    intervalSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });
});
