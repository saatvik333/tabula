import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://tabula.local/",
  pretendToBeVisual: true,
});

const { window } = dom;

const globalAny = globalThis as typeof globalThis & Record<string, unknown>;

globalAny.window = window;
globalAny.document = window.document;
globalAny.navigator = window.navigator;
globalAny.HTMLElement = window.HTMLElement;
globalAny.HTMLAnchorElement = window.HTMLAnchorElement;
globalAny.SVGElement = window.SVGElement;
globalAny.getComputedStyle = window.getComputedStyle.bind(window);

if (!globalAny.requestAnimationFrame) {
  globalAny.requestAnimationFrame = (cb: FrameRequestCallback) => window.setTimeout(() => cb(Date.now()), 16);
}

if (!globalAny.cancelAnimationFrame) {
  globalAny.cancelAnimationFrame = (id: number) => window.clearTimeout(id);
}

for (const key of Object.getOwnPropertyNames(window)) {
  if (!(key in globalAny)) {
    globalAny[key] = (window as unknown as Record<string, unknown>)[key];
  }
}
