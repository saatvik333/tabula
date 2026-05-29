export type TickCallback = () => void;

export type StopTicker = () => void;

export const startAlignedSecondTicker = (callback: TickCallback): StopTicker => {
  let timeoutId: number | undefined;

  const tick = () => {
    callback();
    const now = Date.now();
    const delay = 1000 - (now % 1000);
    timeoutId = window.setTimeout(tick, delay);
  };

  const now = Date.now();
  const delay = 1000 - (now % 1000);
  timeoutId = window.setTimeout(tick, delay);

  return () => {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  };
};
