export type TickCallback = () => void;

export type StopTicker = () => void;

export const startAlignedSecondTicker = (callback: TickCallback): StopTicker => {
  let intervalId: number | undefined;

  const schedule = () => {
    callback();
    intervalId = window.setInterval(callback, 1000);
  };

  const now = Date.now();
  const delay = 1000 - (now % 1000);

  const timeoutId = window.setTimeout(() => {
    schedule();
  }, delay);

  return () => {
    window.clearTimeout(timeoutId);
    if (intervalId !== undefined) {
      window.clearInterval(intervalId);
    }
  };
};
