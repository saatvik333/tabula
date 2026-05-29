import { describe, expect, it } from "vitest";
import { applySettingsToDocument } from "./apply";
import { DEFAULT_SETTINGS } from "./defaults";

describe("apply settings utility", () => {
  it("applies settings properties to the document element", () => {
    const doc = document.implementation.createHTMLDocument();
    applySettingsToDocument(doc, DEFAULT_SETTINGS, "dark");

    const root = doc.documentElement;
    expect(root.dataset["theme"]).toBe("dark");

    // Check basic material surface CSS variables
    expect(root.style.getPropertyValue("--md-surface")).toBe(DEFAULT_SETTINGS.palettes.dark.background);
    expect(root.style.getPropertyValue("--md-outline")).toBe(DEFAULT_SETTINGS.palettes.dark.rim);

    // Check custom tabula transparency variable loop mapping
    expect(root.style.getPropertyValue("--tabula-glass-alpha-strong-top")).toBeDefined();
    expect(root.style.getPropertyValue("--tabula-glass-alpha-highlight-muted")).toBeDefined();
  });
});
