import { createElement } from "$src/core/dom";
import type { NotesWidgetSettings } from "$src/settings/schema";

const NOTES_DEBOUNCE_MS = 500;

type NotesChangeHandler = (content: string) => void;

class NotesWidget {
  private debounceHandle: number | null = null;
  private onChange: NotesChangeHandler | null = null;

  readonly element: HTMLElement;
  private readonly headerEl: HTMLElement;
  private readonly textareaEl: HTMLTextAreaElement;

  constructor() {
    this.element = createElement("div", { className: "tabula-card tabula-widget tabula-widget--notes" });

    this.headerEl = createElement("p", { className: "tabula-widget__title" });
    this.headerEl.textContent = "Quick Notes";

    this.textareaEl = createElement<HTMLTextAreaElement>("textarea", { className: "tabula-widget__textarea" });
    this.textareaEl.placeholder = "Jot down your thoughts...";
    this.textareaEl.rows = 5;

    this.textareaEl.addEventListener("input", () => {
      this.scheduleChange();
    });

    this.element.append(this.headerEl, this.textareaEl);
    this.element.hidden = true;
    this.element.style.display = "none";
  }

  update(settings: NotesWidgetSettings): void {
    if (!settings.enabled) {
      this.element.hidden = true;
      this.element.style.display = "none";
      return;
    }

    this.element.hidden = false;
    this.element.style.display = "";

    // Only update textarea if content differs (avoid clobbering user edits)
    if (this.textareaEl.value !== settings.content) {
      this.textareaEl.value = settings.content;
    }
  }

  setChangeHandler(handler: NotesChangeHandler): void {
    this.onChange = handler;
  }

  destroy(): void {
    this.clearDebounce();
  }

  private scheduleChange(): void {
    this.clearDebounce();
    this.debounceHandle = window.setTimeout(() => {
      if (this.onChange) {
        this.onChange(this.textareaEl.value);
      }
    }, NOTES_DEBOUNCE_MS);
  }

  private clearDebounce(): void {
    if (this.debounceHandle !== null) {
      window.clearTimeout(this.debounceHandle);
      this.debounceHandle = null;
    }
  }
}

export type NotesWidgetController = {
  element: HTMLElement;
  update: (settings: NotesWidgetSettings) => void;
  setChangeHandler: (handler: NotesChangeHandler) => void;
  destroy: () => void;
};

export const createNotesWidget = (): NotesWidgetController => {
  const widget = new NotesWidget();
  return {
    element: widget.element,
    update: (settings) => widget.update(settings),
    setChangeHandler: (handler) => widget.setChangeHandler(handler),
    destroy: () => widget.destroy(),
  };
};
