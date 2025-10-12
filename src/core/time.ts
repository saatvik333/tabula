export type Time = {
  hours: string;
  minutes: string;
  seconds: string;
};

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
