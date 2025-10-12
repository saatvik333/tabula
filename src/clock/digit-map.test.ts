import { describe, expect, it } from "vitest";

import { DIGIT_SIZE, getRotationForCell } from "$src/clock/digit-map";

describe("digit map", () => {
  it("returns 24 cells per digit", () => {
    for (const digit of Array.from({ length: 10 }, (_, value) => value.toString())) {
      const rotations = Array.from({ length: DIGIT_SIZE }, (_, index) => getRotationForCell(digit, index));
      expect(rotations).toHaveLength(DIGIT_SIZE);
    }
  });

  it("maps digits to expected rotations", () => {
    expect(getRotationForCell("0", 0)).toEqual([0, 90]);
    expect(getRotationForCell("0", 1)).toEqual([0, 180]);
    expect(getRotationForCell("1", 0)).toEqual([0, 90]);
    expect(getRotationForCell("1", 3)).toEqual([135, 135]);
  });
});
