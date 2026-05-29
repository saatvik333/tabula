import type { WidgetId, WidgetAnchor, WidgetLayoutEntry, Settings } from "$src/settings/schema";
import { cloneAnchor, formatPx, normaliseOffset } from "$src/settings/anchor";
import { updateSettings } from "$src/settings/storage";

export type WidgetPosition = {
  x: number;
  y: number;
  anchor?: WidgetAnchor;
};

const EDGE_ANCHOR_THRESHOLD = 32;
const WIDGET_IDS: WidgetId[] = ["weather", "pomodoro", "tasks", "notes", "quotes"];

export class WidgetLayoutManager {
  private widgetLayout = new Map<WidgetId, WidgetPosition>();
  private isPersistingLayout = false;
  private activeDrag: {
    id: WidgetId;
    element: HTMLElement;
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null = null;

  constructor(
    private readonly widgetElements: Partial<Record<WidgetId, HTMLElement>>,
    private readonly getSettings: () => Settings | null,
    private readonly updateSettingsState: (settings: Settings) => void,
  ) {}

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.activeDrag || event.pointerId !== this.activeDrag.pointerId) {
      return;
    }

    const deltaX = event.clientX - this.activeDrag.startX;
    const deltaY = event.clientY - this.activeDrag.startY;
    const nextX = this.activeDrag.originX + deltaX;
    const nextY = this.activeDrag.originY + deltaY;
    this.applyWidgetPosition(this.activeDrag.id, this.activeDrag.element, nextX, nextY, { updateLayout: true });
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (!this.activeDrag || event.pointerId !== this.activeDrag.pointerId) {
      return;
    }

    const { element, pointerId, id } = this.activeDrag;
    const coords = this.widgetLayout.get(id);
    if (coords) {
      this.applyWidgetPosition(id, element, coords.x, coords.y, { updateLayout: true });
    }
    element.releasePointerCapture(pointerId);
    element.classList.remove("is-dragging");
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerup", this.handlePointerUp);
    window.removeEventListener("pointercancel", this.handlePointerUp);

    this.activeDrag = null;
    void this.persistWidgetLayout();
  };

  handleWindowResize = (): void => {
    if (!this.getSettings()) {
      return;
    }
    this.reapplyWidgetLayout();
  };

  beginWidgetDrag(id: WidgetId, element: HTMLElement, event: PointerEvent): void {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, select, textarea")) {
      return;
    }

    this.ensureLayoutEntries();

    const existing = this.widgetLayout.get(id);
    const origin = existing ? { x: existing.x, y: existing.y } : this.computePositionFromElement(element);
    const { x, y } = origin;
    this.widgetLayout.set(id, { x, y });

    this.activeDrag = {
      id,
      element,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: x,
      originY: y,
    };

    element.classList.add("is-dragging");
    element.setPointerCapture(event.pointerId);
    window.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("pointercancel", this.handlePointerUp);
    event.preventDefault();
  }

  private computePositionFromElement(element: HTMLElement): WidgetPosition {
    const rect = element.getBoundingClientRect();
    const { x, y } = this.clampPosition(element, rect.left, rect.top);
    return { x, y };
  }

  private clampPosition(element: HTMLElement, x: number, y: number): { x: number; y: number } {
    const bounds = this.getLayoutBounds();
    const padding = 16;
    const measured = element.getBoundingClientRect();
    const width = element.offsetWidth || measured.width || 280;
    const height = element.offsetHeight || measured.height || 180;
    const minX = bounds.left + padding;
    const maxX = bounds.right - width - padding;
    const minY = bounds.top + padding;
    const maxY = bounds.bottom - height - padding;
    const clampedX = Math.min(maxX, Math.max(minX, x));
    const clampedY = Math.min(maxY, Math.max(minY, y));
    return { x: clampedX, y: clampedY };
  }

  private getLayoutBounds(): { left: number; right: number; top: number; bottom: number } {
    return {
      left: 0,
      right: window.innerWidth,
      top: 0,
      bottom: window.innerHeight,
    };
  }

  private getWidgetDimensions(element: HTMLElement | null | undefined): { width: number; height: number } {
    if (!element) {
      return { width: 300, height: 200 };
    }
    const width = element.offsetWidth || element.getBoundingClientRect().width || 300;
    const height = element.offsetHeight || element.getBoundingClientRect().height || 200;
    return { width, height };
  }

  private resolveAnchoredCoordinates(
    element: HTMLElement,
    anchor: WidgetAnchor,
    fallbackX: number,
    fallbackY: number,
  ): { x: number; y: number } {
    const { width, height } = this.getWidgetDimensions(element);
    let x = fallbackX;
    let y = fallbackY;

    if (anchor.horizontal === "right") {
      const offset = typeof anchor.offsetX === "number" && Number.isFinite(anchor.offsetX)
        ? anchor.offsetX
        : Math.max(0, window.innerWidth - (fallbackX + width));
      x = Math.max(0, window.innerWidth - width - offset);
    } else if (anchor.horizontal === "left") {
      const offset = typeof anchor.offsetX === "number" && Number.isFinite(anchor.offsetX)
        ? anchor.offsetX
        : fallbackX;
      x = Math.max(0, offset);
    }

    if (anchor.vertical === "bottom") {
      const offset = typeof anchor.offsetY === "number" && Number.isFinite(anchor.offsetY)
        ? anchor.offsetY
        : Math.max(0, window.innerHeight - (fallbackY + height));
      y = Math.max(0, window.innerHeight - height - offset);
    } else if (anchor.vertical === "top") {
      const offset = typeof anchor.offsetY === "number" && Number.isFinite(anchor.offsetY)
        ? anchor.offsetY
        : fallbackY;
      y = Math.max(0, offset);
    }

    return { x, y };
  }

  private setElementStyle(element: HTMLElement, position: WidgetPosition): void {
    const { anchor } = position;
    const { width, height } = this.getWidgetDimensions(element);

    if (anchor?.horizontal === "right") {
      const fallbackOffset = Math.max(0, window.innerWidth - (position.x + width));
      const offset = normaliseOffset(anchor.offsetX ?? fallbackOffset) ?? fallbackOffset;
      element.style.right = formatPx(offset);
      element.style.left = "";
    } else {
      element.style.left = formatPx(position.x);
      element.style.right = "";
    }

    if (anchor?.vertical === "bottom") {
      const fallbackOffset = Math.max(0, window.innerHeight - (position.y + height));
      const offset = normaliseOffset(anchor.offsetY ?? fallbackOffset) ?? fallbackOffset;
      element.style.bottom = formatPx(offset);
      element.style.top = "";
    } else {
      element.style.top = formatPx(position.y);
      element.style.bottom = "";
    }

    element.style.transform = "";
  }

  private applyWidgetPosition(
    id: WidgetId,
    element: HTMLElement,
    x: number,
    y: number,
    options: { updateLayout?: boolean; anchor?: WidgetAnchor } = {},
  ): void {
    const { updateLayout = false, anchor } = options;
    const usableAnchor = cloneAnchor(anchor);
    const resolved = usableAnchor
      ? this.resolveAnchoredCoordinates(element, usableAnchor, x, y)
      : { x, y };

    const clampedFallback = this.clampPosition(element, resolved.x, resolved.y);
    const clampedX = usableAnchor?.horizontal ? resolved.x : clampedFallback.x;
    const clampedY = usableAnchor?.vertical ? resolved.y : clampedFallback.y;
    const position: WidgetPosition = {
      x: usableAnchor?.horizontal ? clampedX : Math.round(clampedX),
      y: usableAnchor?.vertical ? clampedY : Math.round(clampedY),
      ...(usableAnchor ? { anchor: usableAnchor } : {}),
    };

    this.setElementStyle(element, position);

    if (updateLayout) {
      const cloned = position.anchor ? cloneAnchor(position.anchor) : undefined;
      this.widgetLayout.set(id, {
        x: position.x,
        y: position.y,
        ...(cloned ? { anchor: cloned } : {}),
      });
    }
    const settings = this.getSettings();
    if (element.classList.contains("tabula-widget--initial") && settings) {
      requestAnimationFrame(() => {
        element.classList.remove("tabula-widget--initial");
      });
    }
  }

  hasLayoutChanged(newLayout: WidgetLayoutEntry[]): boolean {
    if (this.widgetLayout.size === 0) {
      return true;
    }
    for (const entry of newLayout) {
      const current = this.widgetLayout.get(entry.id);
      if (!current) return true;
      if (Math.round(current.x) !== Math.round(entry.x) || Math.round(current.y) !== Math.round(entry.y)) return true;
      const currentAnchor = current.anchor;
      const newAnchor = entry.anchor;
      if (!currentAnchor && !newAnchor) continue;
      if (!currentAnchor || !newAnchor) return true;
      if (currentAnchor.horizontal !== newAnchor.horizontal) return true;
      if (currentAnchor.vertical !== newAnchor.vertical) return true;
      if (Math.round(currentAnchor.offsetX ?? -1) !== Math.round(newAnchor.offsetX ?? -1)) return true;
      if (Math.round(currentAnchor.offsetY ?? -1) !== Math.round(newAnchor.offsetY ?? -1)) return true;
    }
    return false;
  }

  loadWidgetLayout(layout: WidgetLayoutEntry[]): void {
    this.widgetLayout.clear();
    layout.forEach((entry) => {
      const cloned = entry.anchor ? cloneAnchor(entry.anchor) : undefined;
      this.widgetLayout.set(entry.id, {
        x: entry.x,
        y: entry.y,
        ...(cloned ? { anchor: cloned } : {}),
      });
    });
    this.ensureLayoutEntries();
  }

  private ensureLayoutEntries(): void {
    const bounds = this.getLayoutBounds();
    const padding = Math.max(24, Math.min(48, window.innerWidth * 0.06));
    let cursorY = bounds.top + padding;

    for (const id of WIDGET_IDS) {
      const element = this.widgetElements[id] ?? null;
      const { width, height } = this.getWidgetDimensions(element);

      if (this.widgetLayout.has(id)) {
        const existing = this.widgetLayout.get(id)!;
        const needsDefault =
          !Number.isFinite(existing.x) ||
          !Number.isFinite(existing.y);

        if (needsDefault) {
          const defaultX = Math.max(bounds.left + padding, bounds.right - width - padding);
          const defaultY = cursorY;
          cursorY = defaultY + height + 20;
          const anchor: WidgetAnchor = {
            horizontal: "right",
            offsetX: Math.max(0, Math.round(bounds.right - (defaultX + width))),
            vertical: "top",
            offsetY: Math.max(0, Math.round(defaultY - bounds.top)),
          };
          this.widgetLayout.set(id, { x: defaultX, y: defaultY, anchor });
        } else {
          const resolved = existing.anchor && element
            ? this.resolveAnchoredCoordinates(element, existing.anchor, existing.x, existing.y)
            : { x: existing.x, y: existing.y };
          const clamped = element ? this.clampPosition(element, resolved.x, resolved.y) : resolved;
          const cloned = existing.anchor ? cloneAnchor(existing.anchor) : undefined;
          this.widgetLayout.set(id, {
            x: clamped.x,
            y: clamped.y,
            ...(cloned ? { anchor: cloned } : {}),
          });
          cursorY = Math.max(cursorY, clamped.y + height + 20);
        }
        continue;
      }

      const x = Math.max(bounds.left + padding, bounds.right - width - padding);
      const y = cursorY;
      cursorY = y + height + 20;
      const anchor: WidgetAnchor = {
        horizontal: "right",
        offsetX: Math.max(0, Math.round(bounds.right - (x + width))),
        vertical: "top",
        offsetY: Math.max(0, Math.round(y - bounds.top)),
      };
      this.widgetLayout.set(id, { x, y, anchor });
    }
  }

  private reapplyWidgetLayout(): void {
    this.ensureLayoutEntries();
    this.applyWidgetLayout();
  }

  serializeWidgetLayout(): WidgetLayoutEntry[] {
    const result: WidgetLayoutEntry[] = [];
    for (const id of WIDGET_IDS) {
      const coords = this.widgetLayout.get(id);
      if (!coords) {
        continue;
      }
      const entry: WidgetLayoutEntry = {
        id,
        x: Math.round(coords.x),
        y: Math.round(coords.y),
      };
      const anchor = cloneAnchor(coords.anchor);
      if (anchor) {
        entry.anchor = anchor;
      }
      result.push(entry);
    }
    return result;
  }

  private deriveAnchorFromPosition(element: HTMLElement, position: WidgetPosition): WidgetAnchor | undefined {
    const { width, height } = this.getWidgetDimensions(element);
    if (width <= 0 || height <= 0) {
      return undefined;
    }

    const distanceLeft = Math.max(0, position.x);
    const distanceRight = Math.max(0, window.innerWidth - (position.x + width));
    const distanceTop = Math.max(0, position.y);
    const distanceBottom = Math.max(0, window.innerHeight - (position.y + height));

    let horizontal: WidgetAnchor["horizontal"];
    if (distanceLeft <= EDGE_ANCHOR_THRESHOLD || distanceRight <= EDGE_ANCHOR_THRESHOLD) {
      horizontal = distanceLeft <= distanceRight ? "left" : "right";
    }

    let vertical: WidgetAnchor["vertical"];
    if (distanceTop <= EDGE_ANCHOR_THRESHOLD || distanceBottom <= EDGE_ANCHOR_THRESHOLD) {
      vertical = distanceTop <= distanceBottom ? "top" : "bottom";
    }

    if (!horizontal && !vertical) {
      return undefined;
    }

    const anchor: WidgetAnchor = {};
    if (horizontal) {
      anchor.horizontal = horizontal;
      const offset = normaliseOffset(horizontal === "left" ? distanceLeft : distanceRight);
      if (typeof offset === "number") {
        anchor.offsetX = offset;
      }
    }
    if (vertical) {
      anchor.vertical = vertical;
      const offset = normaliseOffset(vertical === "top" ? distanceTop : distanceBottom);
      if (typeof offset === "number") {
        anchor.offsetY = offset;
      }
    }

    return anchor;
  }

  async persistWidgetLayout(): Promise<void> {
    const settings = this.getSettings();
    if (!settings) {
      return;
    }

    for (const id of WIDGET_IDS) {
      const element = this.widgetElements[id];
      const coords = this.widgetLayout.get(id);
      if (!element || !coords) {
        continue;
      }
      const anchor = this.deriveAnchorFromPosition(element, coords);
      if (anchor) {
        const cloned = cloneAnchor(anchor);
        if (cloned) {
          coords.anchor = cloned;
        } else {
          delete coords.anchor;
        }
      } else {
        delete coords.anchor;
      }
      const clonedExisting = coords.anchor ? cloneAnchor(coords.anchor) : undefined;
      this.widgetLayout.set(id, {
        x: coords.x,
        y: coords.y,
        ...(clonedExisting ? { anchor: clonedExisting } : {}),
      });
    }

    const layout = this.serializeWidgetLayout();
    const currentLayout = settings.widgets.layout;
    const layoutChanged =
      layout.length !== currentLayout.length ||
      layout.some((entry, index) => {
        const current = currentLayout[index];
        if (!current) {
          return true;
        }
        if (current.id !== entry.id || current.x !== entry.x || current.y !== entry.y) {
          return true;
        }
        const nextAnchor = entry.anchor ?? undefined;
        const currentAnchor = current.anchor ?? undefined;
        if (!currentAnchor && !nextAnchor) {
          return false;
        }
        if (!currentAnchor || !nextAnchor) {
          return true;
        }
        const sameHorizontal = currentAnchor.horizontal === nextAnchor.horizontal;
        const sameVertical = currentAnchor.vertical === nextAnchor.vertical;
        const sameOffsetX = Math.round(currentAnchor.offsetX ?? -1) === Math.round(nextAnchor.offsetX ?? -1);
        const sameOffsetY = Math.round(currentAnchor.offsetY ?? -1) === Math.round(nextAnchor.offsetY ?? -1);
        return !(sameHorizontal && sameVertical && sameOffsetX && sameOffsetY);
      });

    if (!layoutChanged) {
      return;
    }

    const widgets = {
      ...settings.widgets,
      layout,
    };

    this.updateSettingsState({
      ...settings,
      widgets,
    });

    this.isPersistingLayout = true;
    try {
      await updateSettings({
        widgets: {
          layout,
          weather: widgets.weather,
          pomodoro: widgets.pomodoro,
        },
      });
    } catch (error) {
      console.warn("Failed to persist widget layout", error);
    } finally {
      this.isPersistingLayout = false;
    }
  }

  applyWidgetLayout(): void {
    if (!this.getSettings()) {
      return;
    }
    this.ensureLayoutEntries();
    for (const id of WIDGET_IDS) {
      const element = this.widgetElements[id];
      if (!element) {
        continue;
      }
      const coords = this.widgetLayout.get(id);
      if (!coords) {
        continue;
      }
      const opts: { updateLayout?: boolean; anchor?: WidgetAnchor } = {};
      if (coords.anchor) {
        opts.anchor = coords.anchor;
      }
      this.applyWidgetPosition(id, element, coords.x, coords.y, opts);
    }
  }

  getPersistingLayout(): boolean {
    return this.isPersistingLayout;
  }
}
