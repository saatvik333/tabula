import type { WidgetAnchor } from "$src/settings/schema";

export const normaliseOffset = (value: unknown): number | undefined => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return undefined;
  }
  return Math.round(numeric);
};

export const cloneAnchor = (anchor?: WidgetAnchor | null): WidgetAnchor | undefined => {
  if (!anchor) {
    return undefined;
  }

  const clone: WidgetAnchor = {};

  if (anchor.horizontal === "left" || anchor.horizontal === "right") {
    clone.horizontal = anchor.horizontal;
    const offset = normaliseOffset(anchor.offsetX);
    if (typeof offset === "number") {
      clone.offsetX = offset;
    }
  }

  if (anchor.vertical === "top" || anchor.vertical === "bottom") {
    clone.vertical = anchor.vertical;
    const offset = normaliseOffset(anchor.offsetY);
    if (typeof offset === "number") {
      clone.offsetY = offset;
    }
  }

  return Object.keys(clone).length ? clone : undefined;
};

export const sanitizeAnchor = (value: unknown): WidgetAnchor | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<WidgetAnchor> & { offsetX?: unknown; offsetY?: unknown };
  const anchor: WidgetAnchor = {};

  if (candidate.horizontal === "left" || candidate.horizontal === "right") {
    anchor.horizontal = candidate.horizontal;
    const offsetX = normaliseOffset(candidate.offsetX);
    if (typeof offsetX === "number") {
      anchor.offsetX = offsetX;
    }
  }

  if (candidate.vertical === "top" || candidate.vertical === "bottom") {
    anchor.vertical = candidate.vertical;
    const offsetY = normaliseOffset(candidate.offsetY);
    if (typeof offsetY === "number") {
      anchor.offsetY = offsetY;
    }
  }

  if (!anchor.horizontal && !anchor.vertical) {
    return undefined;
  }

  return anchor;
};

export const formatPx = (value: number): string => {
  const normalised = Math.round(value * 100) / 100;
  if (Math.abs(normalised % 1) < 0.01) {
    return `${Math.round(normalised)}px`;
  }
  return `${normalised.toFixed(2)}px`;
};
