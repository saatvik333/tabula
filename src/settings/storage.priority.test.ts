import { beforeEach, describe, expect, it } from "vitest";

import { SETTINGS_STORAGE_KEY } from "$src/settings/schema";

// mock extension storage areas with simple objects, supporting both promise and callback styles
const createArea = (initial: any = {}) => {
  let data: any = { ...initial };
  return {
    get: (key: string, cb?: any) => {
      const value = { [key]: data[key] };
      if (typeof cb === "function") {
        cb(value);
        return;
      }
      return Promise.resolve(value);
    },
    set: (payload: any, cb?: any) => {
      data = { ...data, ...payload };
      if (typeof cb === "function") {
        cb();
        return;
      }
      return Promise.resolve();
    },
    remove: (key: string, cb?: any) => {
      delete data[key];
      if (typeof cb === "function") {
        cb();
        return;
      }
      return Promise.resolve();
    },
    _data: () => data,
  };
};

class MemoryStorage {
  map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, val: string) { this.map.set(key, val); }
  removeItem(key: string) { this.map.delete(key); }
  clear() { this.map.clear(); }
}

let moduleInitialized = false;

const importStorageModule = async () => {
  const mod = await import("$src/settings/storage");
  if (!moduleInitialized && typeof (mod as any).__resetStorageModuleForTests === "function") {
    (mod as any).__resetStorageModuleForTests();
    moduleInitialized = true;
  }
  return mod;
};

describe("settings storage load priority prefers sync first", () => {
  beforeEach(() => {
    (globalThis as any).window = { localStorage: new MemoryStorage() } as any;
    moduleInitialized = false;
    delete (globalThis as any).chrome;
  });

  it("loads from sync when both sync and local areas have values, even if local has different value", async () => {
    const sync = createArea({ [SETTINGS_STORAGE_KEY]: { clock: { format: "24h" } } });
    const local = createArea({ [SETTINGS_STORAGE_KEY]: { clock: { format: "12h" } } });

    (globalThis as any).chrome = {
      storage: { sync, local },
      runtime: { lastError: null },
    } as any;

    const storage = await importStorageModule();
    const loaded = await storage.loadSettings();
    expect(loaded.clock.format).toBe("24h");
  });
});
