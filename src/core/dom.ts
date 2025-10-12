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
