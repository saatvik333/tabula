export type Time = {
  hours: string;
  minutes: string;
  seconds: string;
};

export type Meridiem = "AM" | "PM";

const pad = (value: number): string => value.toString().padStart(2, "0");

export const getCurrentTime = (): Time => {
  const current = new Date();

  return {
    hours: pad(current.getHours()),
    minutes: pad(current.getMinutes()),
    seconds: pad(current.getSeconds()),
  };
};

export const timesEqual = (first: Time, second: Time): boolean =>
  first.hours === second.hours &&
  first.minutes === second.minutes &&
  first.seconds === second.seconds;

export const formatTimeForDisplay = (
  time: Time,
  format: "12h" | "24h",
): Time & { meridiem: Meridiem | null } => {
  if (format !== "12h") {
    return { ...time, meridiem: null };
  }

  const hours24 = Number.parseInt(time.hours, 10) || 0;
  const isPm = hours24 >= 12;
  let converted = hours24 % 12;
  if (converted === 0) {
    converted = 12;
  }

  return {
    hours: pad(converted),
    minutes: time.minutes,
    seconds: time.seconds,
    meridiem: isPm ? "PM" : "AM",
  };
};
