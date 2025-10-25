import { beforeEach, describe, expect, it } from "vitest";

import { ClockApp } from "$src/app/clock-app";
import type { WidgetAnchor } from "$src/settings/schema";

const createWidgetElement = (width: number, height: number): HTMLElement => {
  const element = document.createElement("div");
  Object.defineProperty(element, "offsetWidth", { value: width, configurable: true });
  Object.defineProperty(element, "offsetHeight", { value: height, configurable: true });
  element.getBoundingClientRect = () => ({
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  return element;
};

describe("ClockApp widget anchoring", () => {
  let container: HTMLElement;
  let app: ClockApp;

  beforeEach(() => {
    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    app = new ClockApp(container);
    Object.defineProperty(window, "innerWidth", { value: 1200, writable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, writable: true });
  });

  const getPrivate = <T>(instance: unknown, key: string): T => (instance as Record<string, T | undefined>)[key] as T;

  it("derives anchors for widgets near edges", () => {
    const element = createWidgetElement(240, 180);

    const deriveAnchor = (app as any).deriveAnchorFromPosition.bind(app) as (
      element: HTMLElement,
      position: { x: number; y: number; anchor?: WidgetAnchor },
    ) => WidgetAnchor | undefined;

    const topRight = deriveAnchor(element, { x: 960, y: 24 });
    expect(topRight).toEqual({ horizontal: "right", vertical: "top", offsetX: 0, offsetY: 24 });

    const bottomLeft = deriveAnchor(element, { x: 12, y: 640 });
    expect(bottomLeft).toEqual({ horizontal: "left", vertical: "bottom", offsetX: 12, offsetY: 0 });

    const centre = deriveAnchor(element, { x: 400, y: 220 });
    expect(centre).toBeUndefined();
  });

  it("applies anchored positioning using CSS edges", () => {
    const element = createWidgetElement(200, 160);
    const widgetLayout = getPrivate<Map<string, any>>(app, "widgetLayout");
    const anchor: WidgetAnchor = { horizontal: "right", vertical: "bottom", offsetX: 32, offsetY: 28 };

    (app as any).applyWidgetPosition("weather", element, 900, 400, { updateLayout: true, anchor });

    expect(element.style.left).toBe("");
    expect(element.style.right).toBe("32px");
    expect(element.style.bottom).toBe("28px");
    expect(element.style.top).toBe("");

    const stored = widgetLayout.get("weather");
    expect(stored).toMatchObject({ anchor });
  });

  it("recalculates anchored coordinates after viewport changes", () => {
    const element = createWidgetElement(240, 180);
    const anchor: WidgetAnchor = { horizontal: "right", offsetX: 40, vertical: "top", offsetY: 20 };

    (app as any).applyWidgetPosition("weather", element, 920, 20, { updateLayout: true, anchor });
    expect(element.style.right).toBe("40px");

    Object.defineProperty(window, "innerWidth", { value: 1600, writable: true });
    Object.defineProperty(window, "innerHeight", { value: 900, writable: true });

    const widgetLayout = getPrivate<Map<string, any>>(app, "widgetLayout");
    const coords = widgetLayout.get("weather");
    (app as any).applyWidgetPosition("weather", element, coords.x, coords.y, { updateLayout: true, anchor });

    expect(element.style.right).toBe("40px");
    expect(element.style.top).toBe("20px");
  });
});
