import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://tabula.local/",
  pretendToBeVisual: true,
});

const { window } = dom;

const globalAny = globalThis as typeof globalThis & Record<string, unknown>;

// Set only the DOM globals that Tabula's source modules reference at import time.
// Listed explicitly to avoid the broad window.* copy loop that pollutes globalThis.
globalAny.window = window;
globalAny.document = window.document;
globalAny.navigator = window.navigator;
globalAny.HTMLElement = window.HTMLElement;
globalAny.HTMLAnchorElement = window.HTMLAnchorElement;
globalAny.SVGElement = window.SVGElement;
globalAny.getComputedStyle = window.getComputedStyle.bind(window);
// Storage and event APIs needed by widget tests
globalAny.localStorage = window.localStorage;
globalAny.StorageEvent = window.StorageEvent;
globalAny.SubmitEvent = window.SubmitEvent;
globalAny.Event = window.Event;
globalAny.CustomEvent = window.CustomEvent;
globalAny.KeyboardEvent = window.KeyboardEvent;
globalAny.MouseEvent = window.MouseEvent;
globalAny.PointerEvent = (window as unknown as Record<string, unknown>)["PointerEvent"];

if (!globalAny.requestAnimationFrame) {
  globalAny.requestAnimationFrame = (cb: FrameRequestCallback) => window.setTimeout(() => cb(Date.now()), 16);
}

if (!globalAny.cancelAnimationFrame) {
  globalAny.cancelAnimationFrame = (id: number) => window.clearTimeout(id);
}
