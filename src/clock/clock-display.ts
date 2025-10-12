import { createElement } from "$src/core/dom";
import type { Time } from "$src/core/time";
import { createDigit } from "$src/clock/digit";

type Field = "hours" | "minutes" | "seconds";

type FieldView = {
  element: HTMLElement;
  update: (value: string) => void;
};

const createField = (): FieldView => {
  const firstDigit = createDigit();
  const secondDigit = createDigit();

  const element = createElement("div", { className: "time-field" });
  element.append(firstDigit.element, secondDigit.element);

  return {
    element,
    update: (value: string) => {
      firstDigit.update(value.charAt(0));
      secondDigit.update(value.charAt(1));
    },
  };
};

export type ClockDisplay = {
  element: HTMLElement;
  render: (time: Time) => void;
};

export const createClockDisplay = (): ClockDisplay => {
  const fields: Record<Field, FieldView> = {
    hours: createField(),
    minutes: createField(),
    seconds: createField(),
  };

  const element = createElement("div", { className: "clock" });
  element.append(fields.hours.element, fields.minutes.element, fields.seconds.element);

  const ensureTwoDigits = (value: string): string => value.padStart(2, "0");

  return {
    element,
    render: (time: Time) => {
      fields.hours.update(ensureTwoDigits(time.hours));
      fields.minutes.update(ensureTwoDigits(time.minutes));
      fields.seconds.update(ensureTwoDigits(time.seconds));
    },
  };
};
