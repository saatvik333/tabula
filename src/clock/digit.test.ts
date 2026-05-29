import { describe, expect, it } from "vitest";
import { createDigit } from "./digit";

describe("createDigit View component", () => {
  it("creates element with 24 cell children", () => {
    const digit = createDigit();
    expect(digit.element).toBeDefined();
    expect(digit.element.classList.contains("digit")).toBe(true);

    const cells = digit.element.querySelectorAll(".cell");
    expect(cells).toHaveLength(24);

    const firstCell = cells[0];
    expect(firstCell?.querySelectorAll(".hand")).toHaveLength(2);
    expect(firstCell?.querySelectorAll(".dot")).toHaveLength(1);
  });

  it("updates cell hand rotations based on value", () => {
    const digit = createDigit();
    digit.update("0");

    const cells = digit.element.querySelectorAll(".cell");
    const firstCell = cells[0];
    expect(firstCell).toBeDefined();

    const hands = firstCell!.querySelectorAll(".hand") as NodeListOf<HTMLElement>;
    expect(hands[0]?.style.getPropertyValue("--hand-angle")).toBeDefined();
    expect(hands[1]?.style.getPropertyValue("--hand-angle")).toBeDefined();
  });
});
