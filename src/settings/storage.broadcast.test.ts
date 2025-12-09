import { beforeEach, describe, expect, it } from "vitest";

// We dynamically import the storage module after setting globals
let moduleInitialized = false;

const importStorage = async () => {
  const mod = await import("$src/settings/storage");
  if (!moduleInitialized && typeof (mod as any).__resetStorageModuleForTests === "function") {
    (mod as any).__resetStorageModuleForTests();
    moduleInitialized = true;
  }
  return mod;
};

class MockBroadcastChannel {
  name: string;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  static channels: Record<string, MockBroadcastChannel[]> = {};
  constructor(name: string) {
    this.name = name;
    if (!MockBroadcastChannel.channels[name]) MockBroadcastChannel.channels[name] = [];
    MockBroadcastChannel.channels[name].push(this);
  }
  postMessage(data: any) {
    const peers = MockBroadcastChannel.channels[this.name] || [];
    // simulate async delivery
    queueMicrotask(() => {
      for (const peer of peers) {
        if (peer !== this && typeof peer.onmessage === "function") {
          peer.onmessage({ data } as any);
        }
      }
    });
  }
  close() {}
}

// Simple in-memory localStorage mock for isolation
class MemoryStorage {
  map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, val: string) { this.map.set(key, val); }
  removeItem(key: string) { this.map.delete(key); }
  clear() { this.map.clear(); }
}

describe("settings cross-tab broadcast keeps cache fresh", () => {
  beforeEach(() => {
    (globalThis as any).BroadcastChannel = MockBroadcastChannel as any;
    (MockBroadcastChannel as any).channels = {};
    (globalThis as any).window = { localStorage: new MemoryStorage() } as any;
    delete (globalThis as any).chrome;
    moduleInitialized = false;
  });

  it("updates cachedSettings on broadcast and returns fresh snapshot", async () => {
    const storage1 = await importStorage();
    // subscribe to initialize broadcast listener
    const unsub = storage1.subscribeToSettings(() => {});

    const storage2 = await importStorage();
    const unsub2 = storage2.subscribeToSettings(() => {});

    // load to prime cache in tab 1
    const initial1 = await storage1.loadSettings();
    expect(initial1).toBeTruthy();

    // update via tab 1 (will broadcast)
    const updated = await storage1.updateSettings({ clock: { format: "12h" } as any });
    expect(updated.clock.format).toBe("12h");

    // In tab 2, without calling load, the cached snapshot should reflect broadcasted change
    const snapshot2 = storage2.getCachedSettingsSnapshot();
    expect(snapshot2.clock.format).toBe("12h");

    unsub();
    unsub2();
  });
});
