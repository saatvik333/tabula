import { describe, expect, it } from "vitest";

import { createNotesWidget } from "$src/widgets/notes-widget";
import type { NotesWidgetSettings } from "$src/settings/schema";

describe("createNotesWidget", () => {
  describe("DOM structure", () => {
    it("creates widget element with correct classes", () => {
      const widget = createNotesWidget();
      
      expect(widget.element.tagName.toLowerCase()).toBe("div");
      expect(widget.element.classList.contains("tabula-widget")).toBe(true);
      expect(widget.element.classList.contains("tabula-widget--notes")).toBe(true);
    });

    it("contains header and textarea elements", () => {
      const widget = createNotesWidget();
      
      const header = widget.element.querySelector(".tabula-widget__title");
      const textarea = widget.element.querySelector("textarea");
      
      expect(header).not.toBeNull();
      expect(header?.textContent).toBe("Quick Notes");
      expect(textarea).not.toBeNull();
      expect(textarea?.placeholder).toBe("Jot down your thoughts...");
    });

    it("starts hidden by default", () => {
      const widget = createNotesWidget();
      
      expect(widget.element.hidden).toBe(true);
      expect(widget.element.style.display).toBe("none");
    });

    it("textarea has correct initial configuration", () => {
      const widget = createNotesWidget();
      const textarea = widget.element.querySelector("textarea") as HTMLTextAreaElement;
      
      expect(textarea.rows).toBe(5);
      expect(textarea.value).toBe("");
    });
  });

  describe("update", () => {
    it("shows widget when enabled", () => {
      const widget = createNotesWidget();
      const settings: NotesWidgetSettings = { enabled: true, content: "" };
      
      widget.update(settings);
      
      expect(widget.element.hidden).toBe(false);
      expect(widget.element.style.display).toBe("");
    });

    it("hides widget when disabled", () => {
      const widget = createNotesWidget();
      
      widget.update({ enabled: true, content: "" });
      widget.update({ enabled: false, content: "" });
      
      expect(widget.element.hidden).toBe(true);
      expect(widget.element.style.display).toBe("none");
    });

    it("sets textarea content from settings", () => {
      const widget = createNotesWidget();
      const settings: NotesWidgetSettings = { enabled: true, content: "My notes content" };
      
      widget.update(settings);
      
      const textarea = widget.element.querySelector("textarea");
      expect(textarea?.value).toBe("My notes content");
    });

    it("does not clobber textarea if content matches", () => {
      const widget = createNotesWidget();
      widget.update({ enabled: true, content: "Initial" });
      
      const textarea = widget.element.querySelector("textarea") as HTMLTextAreaElement;
      textarea.value = "User edited";
      
      // Update with same content should not overwrite
      widget.update({ enabled: true, content: "User edited" });
      expect(textarea.value).toBe("User edited");
    });

    it("updates textarea when content differs", () => {
      const widget = createNotesWidget();
      widget.update({ enabled: true, content: "First content" });
      
      const textarea = widget.element.querySelector("textarea") as HTMLTextAreaElement;
      expect(textarea.value).toBe("First content");
      
      widget.update({ enabled: true, content: "Second content" });
      expect(textarea.value).toBe("Second content");
    });
  });

  describe("setChangeHandler", () => {
    it("allows setting a change handler", () => {
      const widget = createNotesWidget();
      const handler = () => {};
      
      // Should not throw
      expect(() => widget.setChangeHandler(handler)).not.toThrow();
    });
  });

  describe("destroy", () => {
    it("can be called without error", () => {
      const widget = createNotesWidget();
      widget.update({ enabled: true, content: "" });
      
      // Should not throw
      expect(() => widget.destroy()).not.toThrow();
    });
  });
});
