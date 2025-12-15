import { describe, expect, it, vi } from "vitest";

import { createTasksWidget } from "$src/widgets/tasks-widget";
import type { TaskItem, Settings } from "$src/settings/schema";

type TasksSettings = Settings["widgets"]["tasks"];

// Helper to submit form in a way compatible with bun/jsdom
const submitForm = (form: HTMLFormElement): void => {
  const event = new SubmitEvent("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(event);
};

describe("createTasksWidget", () => {
  const createMockOptions = () => ({
    onChange: vi.fn(),
  });

  describe("DOM structure", () => {
    it("creates widget element with correct classes", () => {
      const widget = createTasksWidget(createMockOptions());
      
      expect(widget.element.tagName.toLowerCase()).toBe("div");
      expect(widget.element.classList.contains("tabula-widget")).toBe(true);
      expect(widget.element.classList.contains("tabula-widget--tasks")).toBe(true);
    });

    it("contains header with title and meta", () => {
      const widget = createTasksWidget(createMockOptions());
      
      const title = widget.element.querySelector(".tabula-widget__title");
      const meta = widget.element.querySelector(".tabula-widget__meta");
      
      expect(title?.textContent).toBe("Tasks");
      expect(meta?.textContent).toBe("Capture quick todos");
    });

    it("contains task list and form elements", () => {
      const widget = createTasksWidget(createMockOptions());
      
      const list = widget.element.querySelector(".tasks-list");
      const form = widget.element.querySelector(".tasks-form");
      const input = widget.element.querySelector("input");
      const button = widget.element.querySelector("button[type='submit']");
      
      expect(list).not.toBeNull();
      expect(form).not.toBeNull();
      expect(input).not.toBeNull();
      expect(button).not.toBeNull();
    });

    it("starts hidden by default", () => {
      const widget = createTasksWidget(createMockOptions());
      
      expect(widget.element.hidden).toBe(true);
      expect(widget.element.style.display).toBe("none");
    });
  });

  describe("update", () => {
    it("shows widget when enabled", () => {
      const widget = createTasksWidget(createMockOptions());
      const settings: TasksSettings = { enabled: true, items: [] };
      
      widget.update(settings);
      
      expect(widget.element.hidden).toBe(false);
      expect(widget.element.style.display).toBe("");
    });

    it("hides widget when disabled", () => {
      const widget = createTasksWidget(createMockOptions());
      
      widget.update({ enabled: true, items: [] });
      widget.update({ enabled: false, items: [] });
      
      expect(widget.element.hidden).toBe(true);
    });

    it("shows empty message when no tasks", () => {
      const widget = createTasksWidget(createMockOptions());
      widget.update({ enabled: true, items: [] });
      
      const emptyEl = widget.element.querySelector(".tasks-list__empty") as HTMLElement;
      expect(emptyEl.hidden).toBe(false);
      expect(emptyEl.textContent).toBe("Nothing queued");
    });

    it("hides empty message when tasks exist", () => {
      const widget = createTasksWidget(createMockOptions());
      const items: TaskItem[] = [{ id: "1", text: "Test task" }];
      
      widget.update({ enabled: true, items });
      
      const emptyEl = widget.element.querySelector(".tasks-list__empty") as HTMLElement;
      expect(emptyEl.hidden).toBe(true);
    });

    it("renders task items in list", () => {
      const widget = createTasksWidget(createMockOptions());
      const items: TaskItem[] = [
        { id: "1", text: "First task" },
        { id: "2", text: "Second task" },
      ];
      
      widget.update({ enabled: true, items });
      
      const listItems = widget.element.querySelectorAll(".tasks-list__item");
      expect(listItems.length).toBe(2);
      
      const texts = Array.from(listItems).map(
        (li) => li.querySelector(".tasks-list__text")?.textContent
      );
      expect(texts).toContain("First task");
      expect(texts).toContain("Second task");
    });
  });

  describe("add task", () => {
    it("adds task when form is submitted", () => {
      const options = createMockOptions();
      const widget = createTasksWidget(options);
      widget.update({ enabled: true, items: [] });
      
      const input = widget.element.querySelector("input") as HTMLInputElement;
      const form = widget.element.querySelector("form") as HTMLFormElement;
      
      input.value = "New task";
      submitForm(form);
      
      expect(options.onChange).toHaveBeenCalled();
      const calledItems = options.onChange.mock.calls[0]![0] as TaskItem[];
      expect(calledItems.length).toBe(1);
      expect(calledItems[0]!.text).toBe("New task");
    });

    it("clears input after adding task", () => {
      const widget = createTasksWidget(createMockOptions());
      widget.update({ enabled: true, items: [] });
      
      const input = widget.element.querySelector("input") as HTMLInputElement;
      const form = widget.element.querySelector("form") as HTMLFormElement;
      
      input.value = "New task";
      submitForm(form);
      
      expect(input.value).toBe("");
    });

    it("ignores empty input", () => {
      const options = createMockOptions();
      const widget = createTasksWidget(options);
      widget.update({ enabled: true, items: [] });
      
      const input = widget.element.querySelector("input") as HTMLInputElement;
      const form = widget.element.querySelector("form") as HTMLFormElement;
      
      input.value = "   ";
      submitForm(form);
      
      expect(options.onChange).not.toHaveBeenCalled();
    });

    it("prepends new tasks to existing list", () => {
      const options = createMockOptions();
      const widget = createTasksWidget(options);
      const existingItems: TaskItem[] = [{ id: "old", text: "Old task" }];
      
      widget.update({ enabled: true, items: existingItems });
      
      const input = widget.element.querySelector("input") as HTMLInputElement;
      const form = widget.element.querySelector("form") as HTMLFormElement;
      
      input.value = "New task";
      submitForm(form);
      
      const calledItems = options.onChange.mock.calls[0]![0] as TaskItem[];
      expect(calledItems.length).toBe(2);
      expect(calledItems[0]!.text).toBe("New task");
      expect(calledItems[1]!.text).toBe("Old task");
    });
  });

  describe("remove task", () => {
    it("removes task when remove button clicked", () => {
      const options = createMockOptions();
      const widget = createTasksWidget(options);
      const items: TaskItem[] = [
        { id: "1", text: "Task 1" },
        { id: "2", text: "Task 2" },
      ];
      
      widget.update({ enabled: true, items });
      
      const removeButtons = widget.element.querySelectorAll(".tasks-list__remove");
      (removeButtons[0] as HTMLButtonElement).click();
      
      expect(options.onChange).toHaveBeenCalled();
      const calledItems = options.onChange.mock.calls[0]![0] as TaskItem[];
      expect(calledItems.length).toBe(1);
      expect(calledItems[0]!.id).toBe("2");
    });
  });

  describe("capacity limit", () => {
    it("disables input when at max capacity", () => {
      const widget = createTasksWidget(createMockOptions());
      const items: TaskItem[] = Array.from({ length: 60 }, (_, i) => ({
        id: `task-${i}`,
        text: `Task ${i}`,
      }));
      
      widget.update({ enabled: true, items });
      
      const input = widget.element.querySelector("input") as HTMLInputElement;
      const button = widget.element.querySelector("button[type='submit']") as HTMLButtonElement;
      
      expect(input.disabled).toBe(true);
      expect(button.disabled).toBe(true);
      expect(input.placeholder).toBe("Task list full");
    });
  });
});

describe("generateTaskId", () => {
  it("generates unique IDs", () => {
    // Test that different task additions get different IDs
    const options = { onChange: vi.fn() };
    const widget = createTasksWidget(options);
    widget.update({ enabled: true, items: [] });
    
    const input = widget.element.querySelector("input") as HTMLInputElement;
    const form = widget.element.querySelector("form") as HTMLFormElement;
    
    input.value = "Task 1";
    const event1 = new SubmitEvent("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(event1);
    
    input.value = "Task 2";
    const event2 = new SubmitEvent("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(event2);
    
    const firstCall = options.onChange.mock.calls[0]![0] as TaskItem[];
    const secondCall = options.onChange.mock.calls[1]![0] as TaskItem[];
    
    expect(firstCall[0]!.id).not.toBe(secondCall[0]!.id);
  });
});

