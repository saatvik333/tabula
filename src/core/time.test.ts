import { describe, expect, it } from "vitest";

import { formatTimeForDisplay } from "$src/core/time";

describe("formatTimeForDisplay", () => {
  it("returns original time for 24-hour format", () => {
    const result = formatTimeForDisplay({ hours: "18", minutes: "05", seconds: "42" }, "24h");

    expect(result.hours).toBe("18");
    expect(result.minutes).toBe("05");
    expect(result.seconds).toBe("42");
    expect(result.meridiem).toBeNull();
  });

  it("converts midnight to 12 AM", () => {
    const result = formatTimeForDisplay({ hours: "00", minutes: "15", seconds: "09" }, "12h");

    expect(result.hours).toBe("12");
    expect(result.meridiem).toBe("AM");
  });

  it("converts afternoon hours to PM", () => {
    const result = formatTimeForDisplay({ hours: "14", minutes: "30", seconds: "55" }, "12h");

    expect(result.hours).toBe("02");
    expect(result.meridiem).toBe("PM");
  });
});
