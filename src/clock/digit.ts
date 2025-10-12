import { DIGIT_SIZE, getRotationForCell } from "$src/clock/digit-map";
import { createElement } from "$src/core/dom";

const createHand = (): HTMLElement => {
  const hand = createElement("div", { className: "hand" });
  hand.style.rotate = "135deg";
  return hand;
};

const createDot = (): HTMLElement => createElement("div", { className: "dot" });

const updateHand = (hand: HTMLElement, rotation: number): void => {
  hand.style.rotate = `${rotation}deg`;
};

export type DigitView = {
  element: HTMLElement;
  update: (value: string) => void;
};

export const createDigit = (): DigitView => {
  const cells: HTMLElement[] = [];

  for (let index = 0; index < DIGIT_SIZE; index += 1) {
    const cell = createElement("div", { className: "cell" });
    const firstHand = createHand();
    const secondHand = createHand();
    const dot = createDot();

    cell.append(firstHand, secondHand, dot);
    cells.push(cell);
  }

  const element = createElement("div", { className: "digit" });
  element.append(...cells);

  return {
    element,
    update: (value: string) => {
      for (let index = 0; index < DIGIT_SIZE; index += 1) {
        const cell = cells[index];
        if (!cell) {
          throw new Error(`Missing cell for index ${index}`);
        }

        const [first, second] = getRotationForCell(value, index);
        const children = cell.children;
        const firstHand = children.item(0) as HTMLElement | null;
        const secondHand = children.item(1) as HTMLElement | null;

        if (!firstHand || !secondHand) {
          throw new Error("Digit cell is missing hand elements");
        }

        updateHand(firstHand, first);
        updateHand(secondHand, second);
      }
    },
  };
};
