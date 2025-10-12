import { describe, expect, it, vi } from "vitest";

import { startAlignedSecondTicker } from "$src/core/ticker";

describe("startAlignedSecondTicker", () => {
  it("aligns the first tick to the next second boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.500Z"));

    const tick = vi.fn();
    const stop = startAlignedSecondTicker(tick);

    expect(tick).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(tick).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(tick).toHaveBeenCalledTimes(2);

    stop();
    vi.advanceTimersByTime(2000);
    expect(tick).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
