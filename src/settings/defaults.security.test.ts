import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, mergeWithDefaults } from "./defaults";
import { applySettingsToDocument } from "./apply";

describe("Security validations", () => {
  describe("Pinned tab protocols", () => {
    it("drops pinned tab URLs using unsafe protocols", () => {
      const result = mergeWithDefaults({
        pinnedTabs: [
          { id: "safe", title: "Safe", url: "https://example.com" },
          { id: "js", title: "Unsafe", url: "javascript:alert(1)" },
          { id: "file", title: "Unsafe File", url: "file:///etc/passwd" },
          { id: "data", title: "Unsafe Data", url: "data:text/html,test" },
        ],
      });

      expect(result.pinnedTabs).toHaveLength(1);
      expect(result.pinnedTabs[0]?.id).toBe("safe");
    });
  });

  describe("Background image sanitisation", () => {
    it("escapes quotes and backslashes in background imageUrl", () => {
      const doc = document.implementation.createHTMLDocument();
      const settings = {
        ...DEFAULT_SETTINGS,
        background: {
          type: "image-url" as const,
          imageUrl: 'https://example.com/image.jpg?foo=\\"bar\\"',
          imageData: "",
          blur: 10,
          color: "#000000",
        },
      };

      applySettingsToDocument(doc, settings, "dark");
      const img = doc.documentElement.style.getPropertyValue("--tabula-background-image");
      expect(img).toBe('url("https://example.com/image.jpg?foo=\\\\%22bar\\\\%22")');
    });

    it("rejects non-https schemes for background imageUrl", () => {
      const doc = document.implementation.createHTMLDocument();
      const unsafeUrls = [
        "http://example.com/image.png",
        "javascript:alert(1)",
        "data:text/html,test",
        "file:///etc/shadow",
      ];

      for (const url of unsafeUrls) {
        const settings = {
          ...DEFAULT_SETTINGS,
          background: {
            type: "image-url" as const,
            imageUrl: url,
            imageData: "",
            blur: 10,
            color: "#000000",
          },
        };
        applySettingsToDocument(doc, settings, "dark");
        const img = doc.documentElement.style.getPropertyValue("--tabula-background-image");
        expect(img).toBe("none");
      }
    });

    it("accepts valid base64 data URLs and rejects invalid ones", () => {
      const doc = document.implementation.createHTMLDocument();
      const validBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA";
      const invalidBase64 = "data:text/html;base64,Zm9v";

      const settingsValid = {
        ...DEFAULT_SETTINGS,
        background: {
          type: "image-data" as const,
          imageUrl: "",
          imageData: validBase64,
          blur: 10,
          color: "#000000",
        },
      };
      applySettingsToDocument(doc, settingsValid, "dark");
      expect(doc.documentElement.style.getPropertyValue("--tabula-background-image")).toBe(`url("${validBase64}")`);

      const settingsInvalid = {
        ...DEFAULT_SETTINGS,
        background: {
          type: "image-data" as const,
          imageUrl: "",
          imageData: invalidBase64,
          blur: 10,
          color: "#000000",
        },
      };
      applySettingsToDocument(doc, settingsInvalid, "dark");
      expect(doc.documentElement.style.getPropertyValue("--tabula-background-image")).toBe("none");
    });
  });
});
