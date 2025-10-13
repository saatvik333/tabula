import { beforeEach, describe, expect, it } from "vitest";

import { createClockDisplay } from "$src/clock/clock-display";

const extractHandRotation = (cell: Element, index: number): string => {
  const hand = cell.children.item(index) as HTMLElement | null;
  if (!hand) throw new Error("Missing hand element");
  return hand.dataset.angle ?? hand.style.getPropertyValue("--hand-angle");
};

describe("clock display", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders three time fields", () => {
    const display = createClockDisplay();
    expect(display.element.querySelectorAll(".time-field")).toHaveLength(3);
  });

  it("updates digit rotations for supplied time", () => {
    const display = createClockDisplay();
    document.body.append(display.element);

    display.render({ hours: "12", minutes: "34", seconds: "56" });

    const digits = display.element.querySelectorAll(".digit");
    expect(digits).toHaveLength(6);

    const firstHourCell = digits.item(0)?.children.item(0);
    const secondHourCell = digits.item(1)?.children.item(0);

    expect(firstHourCell).toBeInstanceOf(HTMLElement);
    expect(secondHourCell).toBeInstanceOf(HTMLElement);

    if (firstHourCell && secondHourCell) {
      expect(extractHandRotation(firstHourCell, 0)).toBe("0deg");
      expect(extractHandRotation(firstHourCell, 1)).toBe("90deg");
      expect(extractHandRotation(secondHourCell, 0)).toBe("0deg");
      expect(extractHandRotation(secondHourCell, 1)).toBe("90deg");
    }
  });

  it("can toggle seconds visibility", () => {
    const display = createClockDisplay();

    display.render({ hours: "08", minutes: "15", seconds: "42" });
    display.setSecondsVisible(false);

    const fields = display.element.querySelectorAll(".time-field");
    expect(fields).toHaveLength(2);

    display.setSecondsVisible(true);
    const allFields = display.element.querySelectorAll(".time-field");
    expect(allFields).toHaveLength(3);
  });

  it("applies inactive styling to empty cells", () => {
    const display = createClockDisplay();
    display.render({ hours: "11", minutes: "11", seconds: "11" });

    const firstDigit = display.element.querySelector(".digit");
    expect(firstDigit).toBeTruthy();

    const blankCell = firstDigit ? (firstDigit.children.item(3) as HTMLElement | null) : null;
    const activeCell = firstDigit ? (firstDigit.children.item(0) as HTMLElement | null) : null;

    expect(blankCell?.classList.contains("cell--inactive")).toBe(true);
    expect(activeCell?.classList.contains("cell--inactive")).toBe(false);
  });
});
