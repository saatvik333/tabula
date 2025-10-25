import { DEFAULT_SETTINGS, mergeWithDefaults } from "$src/settings/defaults";
import type { PartialSettings, Settings } from "$src/settings/schema";
import { SETTINGS_STORAGE_KEY } from "$src/settings/schema";

type Listener = (settings: Settings) => void;

const listeners = new Set<Listener>();

let cachedSettings: Settings | null = null;

export const cloneSettings = (settings: Settings): Settings => {
  if (typeof structuredClone === "function") {
    return structuredClone(settings);
  }
  return JSON.parse(JSON.stringify(settings)) as Settings;
};

const extensionAPI: any =
  (typeof globalThis !== "undefined" && (globalThis as any).chrome) ??
  (typeof globalThis !== "undefined" && (globalThis as any).browser) ??
  null;

const syncStorage: any = extensionAPI?.storage?.sync ?? null;
const localStorageArea: any = extensionAPI?.storage?.local ?? null;
const extensionOnChanged: any = extensionAPI?.storage?.onChanged ?? null;

const broadcastChannel: BroadcastChannel | null =
  typeof BroadcastChannel === "function" ? new BroadcastChannel("tabula:settings") : null;

const hasExtensionStorage = (): boolean => !!(syncStorage || localStorageArea);

const invokeGet = async (store: any, key: string): Promise<PartialSettings | undefined> => {
  if (!store) return undefined;
  try {
    const result = store.get(key);
    if (result && typeof result.then === "function") {
      const resolved = await result;
      return resolved?.[key] as PartialSettings | undefined;
    }
    return await new Promise<PartialSettings | undefined>((resolve, reject) => {
      store.get(key, (items: Record<string, unknown>) => {
        const error = extensionAPI?.runtime?.lastError;
        if (error) {
          reject(error);
          return;
        }
        resolve(items?.[key] as PartialSettings | undefined);
      });
    });
  } catch (error) {
    throw error;
  }
};

const invokeSet = async (store: any, key: string, value: Settings): Promise<void> => {
  if (!store) return;
  const payload = { [key]: value };
  const result = store.set(payload);
  if (result && typeof result.then === "function") {
    await result;
    return;
  }
  await new Promise<void>((resolve, reject) => {
    store.set(payload, () => {
      const error = extensionAPI?.runtime?.lastError;
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
};

const invokeRemove = async (store: any, key: string): Promise<void> => {
  if (!store?.remove) return;
  const result = store.remove(key);
  if (result && typeof result.then === "function") {
    await result;
    return;
  }
  await new Promise<void>((resolve, reject) => {
    store.remove(key, () => {
      const error = extensionAPI?.runtime?.lastError;
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
};

const localStorageAvailable = (): boolean =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const readFromLocalStorage = (): Settings => {
  if (!localStorageAvailable()) {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }
    return mergeWithDefaults(JSON.parse(raw) as PartialSettings);
  } catch (error) {
    console.warn("Failed to parse stored settings, using defaults", error);
    return DEFAULT_SETTINGS;
  }
};

const writeToLocalStorage = (settings: Settings): void => {
  if (!localStorageAvailable()) return;
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn("Failed to persist settings to localStorage", error);
  }
};

const notify = (settings: Settings): void => {
  const snapshot = cloneSettings(settings);
  cachedSettings = snapshot;
  listeners.forEach((listener) => listener(cloneSettings(snapshot)));
  try {
    broadcastChannel?.postMessage(snapshot);
  } catch (error) {
    console.warn("Failed to broadcast settings", error);
  }
};

let extensionListenerInitialized = false;

const ensureExtensionListener = (): void => {
  if (extensionListenerInitialized || !extensionOnChanged) return;

  const handler = (changes: Record<string, { newValue?: PartialSettings }>, area: string) => {
    if (area !== "sync" && area !== "local") return;
    const change = changes[SETTINGS_STORAGE_KEY];
    if (!change || typeof change !== "object" || typeof change.newValue === "undefined") return;
    notify(mergeWithDefaults(change.newValue));
  };

  extensionOnChanged.addListener(handler);
  extensionListenerInitialized = true;
};

const ensureBroadcastListener = (listener: Listener): BroadcastChannel | null => {
  if (typeof BroadcastChannel !== "function") return null;
  const channel = new BroadcastChannel("tabula:settings");
  channel.onmessage = (event) => {
    if (!event?.data) return;
    const merged = mergeWithDefaults(event.data as PartialSettings);
    // Update local cache and notify all listeners without re-broadcasting to avoid loops
    const snapshot = cloneSettings(merged);
    cachedSettings = snapshot;
    listeners.forEach((l) => l(cloneSettings(snapshot)));
  };
  return channel;
};

export const loadSettings = async (): Promise<Settings> => {
  if (cachedSettings) {
    return cloneSettings(cachedSettings);
  }

  if (hasExtensionStorage()) {
    const storesInPriority = [syncStorage, localStorageArea].filter(Boolean);
    for (const store of storesInPriority) {
      try {
        const raw = await invokeGet(store, SETTINGS_STORAGE_KEY);
        if (raw) {
          const merged = mergeWithDefaults(raw);
          const snapshot = cloneSettings(merged);
          cachedSettings = snapshot;
          return cloneSettings(snapshot);
        }
      } catch (error) {
        console.warn("Failed to read settings from extension storage", error);
      }
    }
  }

  const fallback = readFromLocalStorage();
  const snapshot = cloneSettings(fallback);
  cachedSettings = snapshot;
  return cloneSettings(snapshot);
};

export const getCachedSettingsSnapshot = (): Settings => {
  if (cachedSettings) {
    return cloneSettings(cachedSettings);
  }
  const snapshot = readFromLocalStorage();
  const clone = cloneSettings(snapshot);
  cachedSettings = clone;
  return cloneSettings(clone);
};

const combineWithCurrent = (current: Settings, partial: PartialSettings): Partial<Settings> => ({
  ...current,
  ...partial,
  background: {
    ...current.background,
    ...(partial.background ?? {}),
  },
  clock: {
    ...current.clock,
    ...(partial.clock ?? {}),
  },
  tagline: partial.tagline ?? current.tagline,
  pinnedTabs: partial.pinnedTabs ? [...partial.pinnedTabs] : current.pinnedTabs,
  search: {
    ...current.search,
    ...(partial.search ?? {}),
  },
  widgets: {
    layout: partial.widgets?.layout
      ? partial.widgets.layout.map((entry) => ({
          id: entry.id,
          x: entry.x,
          y: entry.y,
          ...(entry.anchor ? { anchor: { ...entry.anchor } } : {}),
        }))
      : current.widgets.layout.map((entry) => ({
          id: entry.id,
          x: entry.x,
          y: entry.y,
          ...(entry.anchor ? { anchor: { ...entry.anchor } } : {}),
        })),
    weather: {
      ...current.widgets.weather,
      ...(partial.widgets?.weather ?? {}),
    },
    pomodoro: {
      ...current.widgets.pomodoro,
      ...(partial.widgets?.pomodoro ?? {}),
    },
    tasks: {
      ...current.widgets.tasks,
      ...(partial.widgets?.tasks ?? {}),
      items: partial.widgets?.tasks?.items
        ? partial.widgets.tasks.items.map((item) => ({ ...item }))
        : current.widgets.tasks.items.map((item) => ({ ...item })),
    },
  },
  palettes: {
    light: {
      ...current.palettes.light,
      ...(partial.palettes?.light ?? {}),
    },
    dark: {
      ...current.palettes.dark,
      ...(partial.palettes?.dark ?? {}),
    },
  },
});

const persist = async (settings: Settings): Promise<void> => {
  let persisted = false;

  if (syncStorage) {
    try {
      await invokeSet(syncStorage, SETTINGS_STORAGE_KEY, settings);
      persisted = true;
    } catch (error) {
      console.warn("Failed to persist settings to sync storage", error);
      try {
        await invokeRemove(syncStorage, SETTINGS_STORAGE_KEY);
      } catch (removeError) {
        console.warn("Failed to clear stale sync settings", removeError);
      }
    }
  }

  if (!persisted && localStorageArea) {
    try {
      await invokeSet(localStorageArea, SETTINGS_STORAGE_KEY, settings);
      persisted = true;
    } catch (error) {
      console.warn("Failed to persist settings to local storage area", error);
    }
  }

  if (!persisted) {
    writeToLocalStorage(settings);
    return;
  }

  writeToLocalStorage(settings);
};

export const saveSettings = async (settings: Settings): Promise<Settings> => {
  const next = mergeWithDefaults(settings);
  await persist(next);
  notify(next);
  return cloneSettings(next);
};

export const updateSettings = async (partial: PartialSettings): Promise<Settings> => {
  const current = await loadSettings();
  const combined = combineWithCurrent(current, partial);
  const next = mergeWithDefaults(combined);
  await persist(next);
  notify(next);
  return cloneSettings(next);
};

export const subscribeToSettings = (listener: Listener): (() => void) => {
  listeners.add(listener);
  ensureExtensionListener();

  const broadcast = ensureBroadcastListener(listener);

  if (cachedSettings) {
    listener(cloneSettings(cachedSettings));
  }

  return () => {
    listeners.delete(listener);
    broadcast?.close();
  };
};
