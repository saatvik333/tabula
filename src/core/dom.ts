type ElementOptions = {
  className?: string;
};

export const createElement = <T extends HTMLElement>(
  tag: string,
  options: ElementOptions = {},
): T => {
  const element = document.createElement(tag) as T;

  if (options.className) {
    element.className = options.className;
  }

  return element;
};

/**
 * Creates a debounced version of the provided function.
 * The debounced function will delay invoking func until after wait milliseconds
 * have elapsed since the last time it was invoked.
 */
export const debounce = <T extends (...args: unknown[]) => void>(
  func: T,
  wait: number,
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, wait);
  };
};
