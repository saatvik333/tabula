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
  setSecondsVisible: (visible: boolean) => void;
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
  let secondsVisible = true;
  let lastRendered: Time | null = null;

  return {
    element,
    render: (time: Time) => {
      fields.hours.update(ensureTwoDigits(time.hours));
      fields.minutes.update(ensureTwoDigits(time.minutes));
      if (secondsVisible) {
        fields.seconds.update(ensureTwoDigits(time.seconds));
      }
      lastRendered = time;
    },
    setSecondsVisible: (visible: boolean) => {
      if (visible === secondsVisible) {
        return;
      }

      secondsVisible = visible;

      if (visible) {
        const minutesElement = fields.minutes.element;
        const reference = minutesElement.nextSibling;
        if (reference) {
          element.insertBefore(fields.seconds.element, reference);
        } else {
          element.append(fields.seconds.element);
        }
        fields.seconds.element.hidden = false;
        if (lastRendered) {
          fields.seconds.update(ensureTwoDigits(lastRendered.seconds));
        }
      } else {
        fields.seconds.element.hidden = true;
        fields.seconds.element.remove();
      }
    },
  };
};
