import { DEFAULT_SETTINGS, mergeWithDefaults } from "$src/settings/defaults";
import type { PartialSettings, Settings } from "$src/settings/schema";
import { SETTINGS_STORAGE_KEY } from "$src/settings/schema";

type Listener = (settings: Settings) => void;

const listeners = new Set<Listener>();

let cachedSettings: Settings | null = null;

const hasChromeStorage = (): boolean =>
  typeof chrome !== "undefined" && !!chrome.storage && !!chrome.storage.sync;

const readFromChrome = (): Promise<Settings> =>
  new Promise((resolve, reject) => {
    try {
      chrome.storage.sync.get(SETTINGS_STORAGE_KEY, (items) => {
        const raw = items?.[SETTINGS_STORAGE_KEY];
        resolve(mergeWithDefaults(raw));
      });
    } catch (error) {
      reject(error);
    }
  });

const writeToChrome = (settings: Settings): Promise<void> =>
  new Promise((resolve, reject) => {
    try {
      chrome.storage.sync.set({ [SETTINGS_STORAGE_KEY]: settings }, () => resolve());
    } catch (error) {
      reject(error);
    }
  });

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
};

let chromeListenerInitialized = false;

const ensureChromeListener = (): void => {
  if (chromeListenerInitialized || !hasChromeStorage()) return;

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    const change = changes[SETTINGS_STORAGE_KEY];
    if (!change || typeof change !== "object") return;
    if ("newValue" in change) {
      notify(mergeWithDefaults(change.newValue as PartialSettings));
    }
  });

  chromeListenerInitialized = true;
};

export const loadSettings = async (): Promise<Settings> => {
  if (cachedSettings) {
    return cachedSettings;
  }

  const settings = hasChromeStorage()
    ? await readFromChrome().catch((error) => {
        console.warn("Failed to read settings from chrome.storage", error);
        return readFromLocalStorage();
      })
    : readFromLocalStorage();

  cachedSettings = settings;
  return settings;
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
  search: {
    ...current.search,
    ...(partial.search ?? {}),
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

export const saveSettings = async (settings: Settings): Promise<Settings> => {
  const next = mergeWithDefaults(settings);

  if (hasChromeStorage()) {
    await writeToChrome(next).catch((error) => {
      console.warn("Failed to persist settings to chrome.storage", error);
    });
  } else {
    writeToLocalStorage(next);
  }

  notify(next);
  return next;
};

export const updateSettings = async (partial: PartialSettings): Promise<Settings> => {
  const current = await loadSettings();
  const combined = combineWithCurrent(current, partial);
  const next = mergeWithDefaults(combined);

  if (hasChromeStorage()) {
    await writeToChrome(next).catch((error) => {
      console.warn("Failed to persist settings to chrome.storage", error);
    });
  } else {
    writeToLocalStorage(next);
  }

  notify(next);
  return next;
};

export const subscribeToSettings = (listener: Listener): (() => void) => {
  listeners.add(listener);
  ensureChromeListener();

  if (cachedSettings) {
    listener(cachedSettings);
  }

  return () => {
    listeners.delete(listener);
  };
};
