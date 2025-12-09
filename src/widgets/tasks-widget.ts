import { createElement } from "$src/core/dom";
import type { TaskItem, Settings } from "$src/settings/schema";

const MAX_TASK_ITEMS = 60;

const generateTaskId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

type TasksSettings = Settings["widgets"]["tasks"];

type TasksWidgetOptions = {
  onChange: (items: TaskItem[]) => void | Promise<void>;
};

class TasksWidget {
  private settings: TasksSettings = { enabled: true, items: [] };

  readonly element: HTMLElement;

  private readonly listEl: HTMLUListElement;

  private readonly emptyEl: HTMLParagraphElement;

  private readonly inputEl: HTMLInputElement;

  private readonly addButton: HTMLButtonElement;

  constructor(private readonly options: TasksWidgetOptions) {
    this.element = createElement("div", { className: "tabula-card tabula-widget tabula-widget--tasks" });

    const header = createElement("div", { className: "tabula-widget__header" });
    const title = createElement("p", { className: "tabula-widget__title" });
    title.textContent = "Tasks";
    const meta = createElement("p", { className: "tabula-widget__meta" });
    meta.textContent = "Capture quick todos";
    header.append(title, meta);

    this.listEl = createElement("ul", { className: "tasks-list" });
    this.emptyEl = createElement("p", { className: "tabula-widget__status tasks-list__empty" });
    this.emptyEl.textContent = "Nothing queued";

    const form = createElement("form", { className: "tasks-form" });
    this.inputEl = createElement<HTMLInputElement>("input", {
      className: "tasks-form__input tabula-input",
    });
    this.inputEl.type = "text";
    this.inputEl.placeholder = "Add a task";
    this.inputEl.maxLength = 120;

    this.addButton = createElement<HTMLButtonElement>("button", {
      className: "tasks-form__button tabula-button tabula-button--primary",
    });
    this.addButton.type = "submit";
    const addIcon = createElement("span", { className: "material-symbols-outlined" });
    addIcon.setAttribute("aria-hidden", "true");
    addIcon.textContent = "add";
    const addLabel = createElement("span", { className: "tasks-form__button-label" });
    addLabel.textContent = "Add";
    this.addButton.append(addIcon, addLabel);

    form.append(this.inputEl, this.addButton);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.handleAdd();
    });

    this.element.append(header, this.listEl, this.emptyEl, form);
    this.element.hidden = true;
    this.element.style.display = "none";
  }

  update(settings: TasksSettings): void {
    this.settings = {
      enabled: settings.enabled,
      items: settings.items.map((item) => ({ ...item })),
    };

    if (!settings.enabled) {
      this.element.hidden = true;
      this.element.style.display = "none";
      return;
    }

    this.element.hidden = false;
    this.element.style.display = "";
    this.render();
  }

  destroy(): void {
    // No timers to clean up currently, but provides consistent API
  }

  private render(): void {
    this.listEl.replaceChildren();
    const items = this.settings.items;
    if (items.length === 0) {
      this.emptyEl.hidden = false;
    } else {
      this.emptyEl.hidden = true;
      items.forEach((item) => {
        const entry = createElement("li", { className: "tasks-list__item tabula-card" });
        const text = createElement("span", { className: "tasks-list__text" });
        text.textContent = item.text;

        const removeButton = createElement<HTMLButtonElement>("button", {
          className: "tasks-list__remove tabula-button tabula-button--icon",
        });
        removeButton.type = "button";
        removeButton.setAttribute("aria-label", "Remove task");
        const removeIcon = createElement("span", { className: "material-symbols-outlined" });
        removeIcon.setAttribute("aria-hidden", "true");
        removeIcon.textContent = "close";
        const removeSr = createElement("span", { className: "visually-hidden" });
        removeSr.textContent = "Remove";
        removeButton.append(removeIcon, removeSr);
        removeButton.addEventListener("click", () => this.handleRemove(item.id));

        entry.append(text, removeButton);
        this.listEl.append(entry);
      });
    }

    const atCapacity = items.length >= MAX_TASK_ITEMS;
    this.addButton.disabled = atCapacity;
    this.inputEl.disabled = atCapacity;
    if (atCapacity) {
      this.inputEl.placeholder = "Task list full";
    } else {
      this.inputEl.placeholder = "Add a task";
    }
  }

  private handleAdd(): void {
    const value = this.inputEl.value.trim();
    if (!value) {
      return;
    }

    if (this.settings.items.length >= MAX_TASK_ITEMS) {
      return;
    }

    const nextItem: TaskItem = {
      id: generateTaskId(),
      text: value,
    };

    this.settings = {
      ...this.settings,
      items: [nextItem, ...this.settings.items],
    };

    this.commit();
    this.inputEl.value = "";
  }

  private handleRemove(id: string): void {
    const nextItems = this.settings.items.filter((item) => item.id !== id);
    if (nextItems.length === this.settings.items.length) {
      return;
    }
    this.settings = {
      ...this.settings,
      items: nextItems,
    };
    this.commit();
  }

  private commit(): void {
    const items = this.settings.items.map((item) => ({ ...item }));
    try {
      this.options.onChange(items);
    } catch (error) {
      console.warn("Tasks widget change handler failed", error);
    }
    this.render();
  }
}

export type TasksWidgetController = {
  element: HTMLElement;
  update: (settings: TasksSettings) => void;
  destroy: () => void;
};

export const createTasksWidget = (options: TasksWidgetOptions): TasksWidgetController => {
  const widget = new TasksWidget(options);
  return {
    element: widget.element,
    update: (settings) => widget.update(settings),
    destroy: () => widget.destroy(),
  };
};
