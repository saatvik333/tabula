import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { createElement, debounce } from "$src/core/dom";

describe("createElement", () => {
  it("creates an element with the specified tag", () => {
    const div = createElement("div");
    expect(div.tagName.toLowerCase()).toBe("div");
  });

  it("creates different element types", () => {
    const span = createElement("span");
    const button = createElement<HTMLButtonElement>("button");
    const input = createElement<HTMLInputElement>("input");

    expect(span.tagName.toLowerCase()).toBe("span");
    expect(button.tagName.toLowerCase()).toBe("button");
    expect(input.tagName.toLowerCase()).toBe("input");
  });

  it("applies className when provided", () => {
    const element = createElement("div", { className: "test-class" });
    expect(element.className).toBe("test-class");
  });

  it("applies multiple classes when provided", () => {
    const element = createElement("div", { className: "class-one class-two" });
    expect(element.classList.contains("class-one")).toBe(true);
    expect(element.classList.contains("class-two")).toBe(true);
  });

  it("creates element without className when not provided", () => {
    const element = createElement("div");
    expect(element.className).toBe("");
  });

  it("creates element without className when empty options", () => {
    const element = createElement("div", {});
    expect(element.className).toBe("");
  });
});

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("delays function execution", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("cancels previous calls on rapid invocation", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);
    debounced();
    vi.advanceTimersByTime(50);
    debounced();
    vi.advanceTimersByTime(50);

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("passes arguments to the original function", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("arg1", "arg2");
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith("arg1", "arg2");
  });

  it("uses the latest arguments when called multiple times", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("first");
    debounced("second");
    debounced("third");
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("third");
  });

  it("allows multiple separate invocations after wait period", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("call1");
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith("call1");

    debounced("call2");
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith("call2");

    expect(fn).toHaveBeenCalledTimes(2);
  });
});
