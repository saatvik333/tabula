import { DEFAULT_SETTINGS, mergeWithDefaults } from "$src/settings/defaults";
import type { PartialSettings, Settings } from "$src/settings/schema";
import { SETTINGS_STORAGE_KEY } from "$src/settings/schema";

type Listener = (settings: Settings) => void;

const listeners = new Set<Listener>();

let cachedSettings: Settings | null = null;

const extensionAPI: any =
  (typeof globalThis !== "undefined" && (globalThis as any).chrome) ??
  (typeof globalThis !== "undefined" && (globalThis as any).browser) ??
  null;

const extensionStorage: any = extensionAPI?.storage?.sync ?? extensionAPI?.storage?.local ?? null;
const extensionOnChanged: any = extensionAPI?.storage?.onChanged ?? null;

const broadcastChannel: BroadcastChannel | null =
  typeof BroadcastChannel === "function" ? new BroadcastChannel("tabula:settings") : null;

const hasExtensionStorage = (): boolean => !!extensionStorage;

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
  cachedSettings = settings;
  listeners.forEach((listener) => listener(settings));
  try {
    broadcastChannel?.postMessage(settings);
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
    listener(mergeWithDefaults(event.data as PartialSettings));
  };
  return channel;
};

export const loadSettings = async (): Promise<Settings> => {
  if (cachedSettings) {
    return cachedSettings;
  }

  if (hasExtensionStorage()) {
    try {
      const raw = await invokeGet(extensionStorage, SETTINGS_STORAGE_KEY);
      const merged = mergeWithDefaults(raw);
      cachedSettings = merged;
      return merged;
    } catch (error) {
      console.warn("Failed to read settings from extension storage", error);
    }
  }

  const fallback = readFromLocalStorage();
  cachedSettings = fallback;
  return fallback;
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
      ? partial.widgets.layout.map((entry) => ({ ...entry }))
      : current.widgets.layout.map((entry) => ({ ...entry })),
    weather: {
      ...current.widgets.weather,
      ...(partial.widgets?.weather ?? {}),
    },
    pomodoro: {
      ...current.widgets.pomodoro,
      ...(partial.widgets?.pomodoro ?? {}),
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
  if (hasExtensionStorage()) {
    try {
      await invokeSet(extensionStorage, SETTINGS_STORAGE_KEY, settings);
      return;
    } catch (error) {
      console.warn("Failed to persist settings to extension storage", error);
    }
  }
  writeToLocalStorage(settings);
};

export const saveSettings = async (settings: Settings): Promise<Settings> => {
  const next = mergeWithDefaults(settings);
  await persist(next);
  notify(next);
  return next;
};

export const updateSettings = async (partial: PartialSettings): Promise<Settings> => {
  const current = await loadSettings();
  const combined = combineWithCurrent(current, partial);
  const next = mergeWithDefaults(combined);
  await persist(next);
  notify(next);
  return next;
};

export const subscribeToSettings = (listener: Listener): (() => void) => {
  listeners.add(listener);
  ensureExtensionListener();

  const broadcast = ensureBroadcastListener(listener);

  if (cachedSettings) {
    listener(cachedSettings);
  }

  return () => {
    listeners.delete(listener);
    broadcast?.close();
  };
};
