import { DEFAULT_SETTINGS, mergeWithDefaults } from "$src/settings/defaults";
import { applySettingsToDocument } from "$src/settings/apply";
import type {
  Settings,
  ThemeMode,
  SearchEngine,
  SearchPosition,
  PresetName,
  Palette,
  TimeFormat,
  TemperatureUnit,
} from "$src/settings/schema";
import { applyPresetToSettings, listAvailablePresets } from "$src/settings/presets";
import { loadSettings, saveSettings } from "$src/settings/storage";
import { getSystemPrefersDark, resolveTheme } from "$src/settings/theme";
import { createPinnedTabsController } from "./pinned-tabs";

const clone = <T>(value: T): T =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);

const getElement = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element with id "${id}"`);
  }
  return element as T;
};

const statusEl = getElement<HTMLDivElement>("status");
const form = getElement<HTMLFormElement>("settings-form");
const resetButton = getElement<HTMLButtonElement>("resetButton");

const themeModeSelect = getElement<HTMLSelectElement>("themeMode");
const taglineInput = getElement<HTMLInputElement>("taglineInput");
const taglineEnabledInput = getElement<HTMLInputElement>("taglineEnabled");
const timeFormat24Input = getElement<HTMLInputElement>("timeFormat24");
const clockEnabledInput = getElement<HTMLInputElement>("clockEnabled");
const timeFormat12Input = getElement<HTMLInputElement>("timeFormat12");
const showSecondsInput = getElement<HTMLInputElement>("showSeconds");

const backgroundImageInput = getElement<HTMLInputElement>("backgroundImage");
const backgroundImageUpload = getElement<HTMLInputElement>("backgroundImageUpload");
const backgroundImageStatus = getElement<HTMLParagraphElement>("backgroundImageStatus");
const backgroundImageClear = getElement<HTMLButtonElement>("backgroundImageClear");
const backgroundBlurRange = getElement<HTMLInputElement>("backgroundBlur");
const backgroundBlurValue = getElement<HTMLOutputElement>("backgroundBlurValue");

const clockScaleRange = getElement<HTMLInputElement>("clockScale");
const clockScaleValue = getElement<HTMLOutputElement>("clockScaleValue");
const rimWidthRange = getElement<HTMLInputElement>("rimWidth");
const rimWidthValue = getElement<HTMLOutputElement>("rimWidthValue");
const handWidthRange = getElement<HTMLInputElement>("handWidth");
const handWidthValue = getElement<HTMLOutputElement>("handWidthValue");
const dotSizeRange = getElement<HTMLInputElement>("dotSize");
const dotSizeValue = getElement<HTMLOutputElement>("dotSizeValue");

const lightBackgroundInput = getElement<HTMLInputElement>("lightBackground");
const lightFaceInput = getElement<HTMLInputElement>("lightFace");
const lightRimInput = getElement<HTMLInputElement>("lightRim");
const lightHandInput = getElement<HTMLInputElement>("lightHand");
const lightAccentInput = getElement<HTMLInputElement>("lightAccent");

const darkBackgroundInput = getElement<HTMLInputElement>("darkBackground");
const darkFaceInput = getElement<HTMLInputElement>("darkFace");
const darkRimInput = getElement<HTMLInputElement>("darkRim");
const darkHandInput = getElement<HTMLInputElement>("darkHand");
const darkAccentInput = getElement<HTMLInputElement>("darkAccent");

const searchEnabledInput = getElement<HTMLInputElement>("searchEnabled");
const searchEngineSelect = getElement<HTMLSelectElement>("searchEngine");
const searchPlaceholderInput = getElement<HTMLInputElement>("searchPlaceholder");
const searchTopInput = getElement<HTMLInputElement>("searchTop");
const searchBottomInput = getElement<HTMLInputElement>("searchBottom");
const weatherEnabledInput = getElement<HTMLInputElement>("weatherEnabled");
const weatherLocationInput = getElement<HTMLInputElement>("weatherLocation");
const weatherUnitSelect = getElement<HTMLSelectElement>("weatherUnit");
const pomodoroEnabledInput = getElement<HTMLInputElement>("pomodoroEnabled");
const pomodoroFocusInput = getElement<HTMLInputElement>("pomodoroFocus");
const pomodoroBreakInput = getElement<HTMLInputElement>("pomodoroBreak");
const pomodoroLongBreakInput = getElement<HTMLInputElement>("pomodoroLongBreak");
const pomodoroCyclesInput = getElement<HTMLInputElement>("pomodoroCycles");
// Notification inputs
const pomodoroNotificationsEnabledInput = getElement<HTMLInputElement>("pomodoroNotificationsEnabled");
const pomodoroFocusTitleInput = getElement<HTMLInputElement>("pomodoroFocusTitle");
const pomodoroFocusBodyInput = getElement<HTMLInputElement>("pomodoroFocusBody");
const pomodoroShortBreakTitleInput = getElement<HTMLInputElement>("pomodoroShortBreakTitle");
const pomodoroShortBreakBodyInput = getElement<HTMLInputElement>("pomodoroShortBreakBody");
const pomodoroLongBreakTitleInput = getElement<HTMLInputElement>("pomodoroLongBreakTitle");
const pomodoroLongBreakBodyInput = getElement<HTMLInputElement>("pomodoroLongBreakBody");
const tasksEnabledInput = getElement<HTMLInputElement>("tasksEnabled");
const presetContainer = getElement<HTMLDivElement>("presetChips");
const pinnedListContainer = getElement<HTMLDivElement>("pinnedList");
const pinnedEmptyState = getElement<HTMLParagraphElement>("pinnedEmpty");
const pinnedAddTitleInput = getElement<HTMLInputElement>("pinnedAddTitle");
const pinnedAddUrlInput = getElement<HTMLInputElement>("pinnedAddUrl");
const pinnedAddIconInput = getElement<HTMLInputElement>("pinnedAddIcon");
const pinnedAddButton = getElement<HTMLButtonElement>("pinnedAddButton");
const settingsNav = getElement<HTMLElement>("settingsNav");

const setStatus = (text: string, tone: "default" | "success" | "error" = "default") => {
  statusEl.textContent = text;
  statusEl.dataset["tone"] = tone;
};

let previewHandle = 0;
let isApplyingPreset = false;
let presetButtons: HTMLButtonElement[] = [];

const MAX_PINNED_TABS = 12;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

type UploadMeta = {
  name: string;
  size: number;
} | null;

let uploadedImageMeta: UploadMeta = null;

const formatBytes = (size: number): string => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

/**
 * Compresses an image to fit within target bytes by aggressively resizing.
 * Targets 2MB to leave headroom for Chrome storage limits.
 */
const compressImage = async (dataUrl: string, maxBytes: number): Promise<string> => {
  // Target 2MB for better Chrome compatibility
  const targetBytes = Math.min(maxBytes, 2 * 1024 * 1024);
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let quality = 0.85;
      let scale = 1.0;
      let attempts = 0;
      const MAX_ATTEMPTS = 20;
      
      const tryCompress = (): void => {
        if (attempts++ > MAX_ATTEMPTS) {
          // Give up after too many attempts
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(img.width * 0.3);
          canvas.height = Math.floor(img.height * 0.3);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
          } else {
            reject(new Error('Could not get canvas context'));
          }
          return;
        }
        
        const canvas = document.createElement('canvas');
        const targetWidth = Math.floor(img.width * scale);
        const targetHeight = Math.floor(img.height * scale);
        
        // Minimum dimensions to prevent unusable images
        if (targetWidth < 400 || targetHeight < 300) {
          canvas.width = Math.max(400, targetWidth);
          canvas.height = Math.max(300, targetHeight);
        } else {
          canvas.width = targetWidth;
          canvas.height = targetHeight;
        }
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const compressed = canvas.toDataURL('image/jpeg', quality);
        const estimatedBytes = estimateDataUrlBytes(compressed);
        
        // If still too large, reduce more aggressively
        if (estimatedBytes > targetBytes) {
          if (scale > 0.35) {
            // Reduce scale more aggressively
            scale -= 0.15;
            tryCompress();
          } else if (quality > 0.4) {
            quality -= 0.15;
            tryCompress();
          } else {
            // Best effort - return what we have
            resolve(compressed);
          }
        } else {
          resolve(compressed);
        }
      };
      
      tryCompress();
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
};

const estimateDataUrlBytes = (dataUrl: string): number => {
  const parts = dataUrl.split(",");
  if (parts.length < 2) return 0;
  const base64 = parts[1]?.replace(/=+$/, "") ?? "";
  return Math.floor((base64.length * 3) / 4);
};

const generatePinnedId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const isValidPinnedUrl = (value: string): boolean => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const schedule = (fn: () => void, delay = 60) => {
  window.clearTimeout(previewHandle);
  previewHandle = window.setTimeout(fn, delay);
};

let state: Settings = clone(DEFAULT_SETTINGS);

const applyPreview = () => {
  const theme = resolveTheme(state.themeMode, getSystemPrefersDark());
  applySettingsToDocument(document, state, theme);
};

const pinnedTabsController = createPinnedTabsController({
  list: pinnedListContainer,
  emptyState: pinnedEmptyState,
  addControls: {
    title: pinnedAddTitleInput,
    url: pinnedAddUrlInput,
    icon: pinnedAddIconInput,
    submit: pinnedAddButton,
  },
  maxItems: MAX_PINNED_TABS,
  generateId: generatePinnedId,
  validateUrl: isValidPinnedUrl,
  onChange: (tabs) => {
    state.pinnedTabs = tabs;
    schedule(applyPreview);
  },
  setStatus,
});

const updateRangeOutputs = () => {
  clockScaleValue.value = `${state.clock.scale.toFixed(2)}x`;
  rimWidthValue.value = `${state.clock.rimWidth.toFixed(1)}px`;
  handWidthValue.value = `${state.clock.handWidth.toFixed(1)}px`;
  dotSizeValue.value = `${Math.round(state.clock.dotSize)}px`;
  backgroundBlurValue.value = `${Math.round(state.background.blur)}px`;
};

const updateBackgroundImageStatus = () => {
  if (state.background.imageData) {
    const bytes = estimateDataUrlBytes(state.background.imageData);
    if (!uploadedImageMeta && bytes > 0) {
      uploadedImageMeta = {
        name: "Custom image",
        size: bytes,
      };
    }

    const label = uploadedImageMeta
      ? `${uploadedImageMeta.name} • ${formatBytes(uploadedImageMeta.size)}`
      : "Custom image in use";
    backgroundImageStatus.textContent = label;
    backgroundImageStatus.dataset["tone"] = "active";
    backgroundImageClear.disabled = false;
  } else {
    backgroundImageStatus.textContent = "No image selected";
    backgroundImageStatus.dataset["tone"] = "muted";
    backgroundImageClear.disabled = true;
    uploadedImageMeta = null;
  }
};

const updateSearchFieldState = (enabled: boolean) => {
  const dependsGroup = document.querySelector('[data-depends="searchEnabled"]') as HTMLElement | null;
  if (dependsGroup) {
    if (enabled) {
      delete dependsGroup.dataset["disabled"];
    } else {
      dependsGroup.dataset["disabled"] = "true";
    }
  }
  [searchEngineSelect, searchPlaceholderInput, searchTopInput, searchBottomInput].forEach((element) => {
    element.disabled = !enabled;
  });
};

const markWidgetFields = (elements: HTMLElement[], enabled: boolean) => {
  elements.forEach((element) => {
    if (enabled) {
      delete element.dataset["disabled"];
    } else {
      element.dataset["disabled"] = "true";
    }
    const controls = element.querySelectorAll<HTMLElement>("input, select");
    controls.forEach((control) => {
      (control as HTMLInputElement | HTMLSelectElement).disabled = !enabled;
    });
  });
};

const weatherFieldElements = [weatherLocationInput.parentElement!, weatherUnitSelect.parentElement!].filter(Boolean) as HTMLElement[];
const pomodoroFieldElements = [
  pomodoroFocusInput.parentElement!,
  pomodoroBreakInput.parentElement!,
  pomodoroLongBreakInput.parentElement!,
  pomodoroCyclesInput.parentElement!,
].filter(Boolean) as HTMLElement[];
const tasksFieldElements = Array.from(document.querySelectorAll<HTMLElement>("[data-widget='tasks']"));

const updateWeatherFieldState = (enabled: boolean) => {
  markWidgetFields(weatherFieldElements, enabled);
};

const updatePomodoroFieldState = (enabled: boolean) => {
  markWidgetFields(pomodoroFieldElements, enabled);
};

const updateTasksFieldState = (enabled: boolean) => {
  tasksFieldElements.forEach((element) => {
    if (enabled) {
      delete element.dataset["disabled"];
      element.hidden = false;
    } else {
      element.dataset["disabled"] = "true";
      element.hidden = true;
    }
  });
};

const updateNotificationFieldState = (enabled: boolean) => {
  const dependsGroup = document.querySelector('[data-depends="pomodoroNotificationsEnabled"]') as HTMLElement | null;
  if (dependsGroup) {
    if (enabled) {
      delete dependsGroup.dataset["disabled"];
    } else {
      dependsGroup.dataset["disabled"] = "true";
    }
  }
  [
    pomodoroFocusTitleInput,
    pomodoroFocusBodyInput,
    pomodoroShortBreakTitleInput,
    pomodoroShortBreakBodyInput,
    pomodoroLongBreakTitleInput,
    pomodoroLongBreakBodyInput,
  ].forEach((element) => {
    element.disabled = !enabled;
  });
};

// Sidebar Navigation
const initSidebarNavigation = () => {
  const navItems = settingsNav.querySelectorAll<HTMLButtonElement>('.nav-item');
  const sections = document.querySelectorAll<HTMLElement>('.section');

  const showSection = (sectionName: string) => {
    sections.forEach((section) => {
      const isTarget = section.dataset['section'] === sectionName;
      section.classList.toggle('is-active', isTarget);
    });
    navItems.forEach((item) => {
      const isTarget = item.dataset['section'] === sectionName;
      item.classList.toggle('is-active', isTarget);
    });
  };

  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const section = item.dataset['section'];
      if (section) {
        showSection(section);
      }
    });
  });
};

const markPresetActive = (name: PresetName) => {
  presetButtons.forEach((btn) => {
    const isActive = btn.dataset["preset"] === name;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  });
};

const setClockFormat = (format: TimeFormat): void => {
  state.clock.format = format;
  setStatus("Clock format updated", "success");
};

const renderPresetChips = () => {
  presetContainer.innerHTML = "";
  const fragment = document.createDocumentFragment();
  presetButtons = listAvailablePresets().map((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset-chip";
    button.dataset["preset"] = preset;
    button.textContent = preset
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    button.addEventListener("click", () => {
      state = applyPresetToSettings(preset, state);
      isApplyingPreset = true;
      syncForm(state);
      isApplyingPreset = false;
      setStatus(`Applied ${button.textContent} preset`, "success");
    });
    fragment.appendChild(button);
    return button;
  });

  presetContainer.appendChild(fragment);
};

const syncForm = (settings: Settings) => {
  state = clone(settings);

  themeModeSelect.value = state.themeMode;
  taglineInput.value = state.tagline;
  taglineEnabledInput.checked = Boolean(state.taglineEnabled);
  taglineInput.disabled = !state.taglineEnabled;
  clockEnabledInput.checked = Boolean(state.clock.enabled);
  if (state.clock.format === "12h") {
    timeFormat12Input.checked = true;
  } else {
    timeFormat24Input.checked = true;
  }
  showSecondsInput.checked = Boolean(state.clock.showSeconds);

  backgroundImageInput.value = state.background.imageUrl;
  backgroundImageUpload.value = "";
  backgroundBlurRange.value = state.background.blur.toString();
  uploadedImageMeta = state.background.imageData ? uploadedImageMeta : null;
  updateBackgroundImageStatus();

  clockScaleRange.value = state.clock.scale.toString();
  rimWidthRange.value = state.clock.rimWidth.toString();
  handWidthRange.value = state.clock.handWidth.toString();
  dotSizeRange.value = state.clock.dotSize.toString();

  lightBackgroundInput.value = state.palettes.light.background;
  lightFaceInput.value = state.palettes.light.face;
  lightRimInput.value = state.palettes.light.rim;
  lightHandInput.value = state.palettes.light.hand;
  lightAccentInput.value = state.palettes.light.accent;

  darkBackgroundInput.value = state.palettes.dark.background;
  darkFaceInput.value = state.palettes.dark.face;
  darkRimInput.value = state.palettes.dark.rim;
  darkHandInput.value = state.palettes.dark.hand;
  darkAccentInput.value = state.palettes.dark.accent;

  searchEnabledInput.checked = state.search.enabled;
  searchEngineSelect.value = state.search.engine;
  searchPlaceholderInput.value = state.search.placeholder;
  if (state.search.position === "top") {
    searchTopInput.checked = true;
  } else {
    searchBottomInput.checked = true;
  }

  weatherEnabledInput.checked = state.widgets.weather.enabled;
  weatherLocationInput.value = state.widgets.weather.location;
  weatherUnitSelect.value = state.widgets.weather.unit;
  updateWeatherFieldState(state.widgets.weather.enabled);

  pomodoroEnabledInput.checked = state.widgets.pomodoro.enabled;
  pomodoroFocusInput.value = state.widgets.pomodoro.focusMinutes.toString();
  pomodoroBreakInput.value = state.widgets.pomodoro.breakMinutes.toString();
  pomodoroLongBreakInput.value = state.widgets.pomodoro.longBreakMinutes.toString();
  pomodoroCyclesInput.value = state.widgets.pomodoro.cyclesBeforeLongBreak.toString();
  updatePomodoroFieldState(state.widgets.pomodoro.enabled);
  tasksEnabledInput.checked = state.widgets.tasks.enabled;
  updateTasksFieldState(state.widgets.tasks.enabled);

  updateRangeOutputs();
  updateSearchFieldState(state.search.enabled);
  pinnedTabsController.sync(state.pinnedTabs);
  applyPreview();
  markPresetActive(state.preset ?? "custom");

  // Notification settings
  pomodoroNotificationsEnabledInput.checked = state.widgets.pomodoro.notifications.enabled;
  pomodoroFocusTitleInput.value = state.widgets.pomodoro.notifications.focusTitle;
  pomodoroFocusBodyInput.value = state.widgets.pomodoro.notifications.focusBody;
  pomodoroShortBreakTitleInput.value = state.widgets.pomodoro.notifications.shortBreakTitle;
  pomodoroShortBreakBodyInput.value = state.widgets.pomodoro.notifications.shortBreakBody;
  pomodoroLongBreakTitleInput.value = state.widgets.pomodoro.notifications.longBreakTitle;
  pomodoroLongBreakBodyInput.value = state.widgets.pomodoro.notifications.longBreakBody;
  updateNotificationFieldState(state.widgets.pomodoro.notifications.enabled);
};

const handleThemeModeChange = () => {
  state.themeMode = themeModeSelect.value as ThemeMode;
  if (!isApplyingPreset) {
    state.preset = "custom";
    markPresetActive(state.preset);
  }
  schedule(() => {
    applyPreview();
    setStatus("Preview updated");
  });
};

const handlePaletteChange = (theme: "light" | "dark", key: keyof Settings["palettes"]["light"], value: string) => {
  state.palettes[theme][key] = value;
  schedule(applyPreview);
};

const handleSearchPositionChange = (position: SearchPosition) => {
  state.search.position = position;
  schedule(applyPreview);
};

themeModeSelect.addEventListener("change", handleThemeModeChange);

taglineInput.addEventListener("input", () => {
  state.tagline = taglineInput.value;
});

taglineEnabledInput.addEventListener("change", () => {
  state.taglineEnabled = taglineEnabledInput.checked;
  taglineInput.disabled = !state.taglineEnabled;
  schedule(() => setStatus(`Tagline ${state.taglineEnabled ? "shown" : "hidden"}`));
});

timeFormat24Input.addEventListener("change", () => {
  if (timeFormat24Input.checked) {
    setClockFormat("24h");
  }
});

timeFormat12Input.addEventListener("change", () => {
  if (timeFormat12Input.checked) {
    setClockFormat("12h");
  }
});

clockEnabledInput.addEventListener("change", () => {
  state.clock.enabled = clockEnabledInput.checked;
  schedule(() => setStatus(`Clock ${state.clock.enabled ? "shown" : "hidden"}`));
});

showSecondsInput.addEventListener("change", () => {
  state.clock.showSeconds = showSecondsInput.checked;
  schedule(() => setStatus(`Seconds ${state.clock.showSeconds ? "shown" : "hidden"}`));
});

backgroundImageInput.addEventListener("input", () => {
  state.background.imageUrl = backgroundImageInput.value.trim();
  if (!isApplyingPreset) {
    state.preset = "custom";
    markPresetActive(state.preset);
  }
  schedule(applyPreview);
});

backgroundImageUpload.addEventListener("change", async () => {
  const [file] = backgroundImageUpload.files ?? [];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", async () => {
    const result = reader.result;
    if (typeof result !== "string") {
      setStatus("Unsupported image encoding", "error");
      return;
    }

    let imageData = result;
    const initialSize = estimateDataUrlBytes(imageData);

    // Auto-compress if over limit
    if (initialSize > MAX_IMAGE_BYTES) {
      setStatus(`Compressing image (${formatBytes(initialSize)})...`, "default");
      try {
        imageData = await compressImage(imageData, MAX_IMAGE_BYTES);
        const finalSize = estimateDataUrlBytes(imageData);
        setStatus(`Image compressed from ${formatBytes(initialSize)} to ${formatBytes(finalSize)}`, "success");
      } catch (error) {
        backgroundImageUpload.value = "";
        setStatus("Failed to compress image", "error");
        return;
      }
    }

    state.background.imageData = imageData;
    state.background.type = "image";
    uploadedImageMeta = { name: file.name, size: estimateDataUrlBytes(imageData) };
    updateBackgroundImageStatus();
    if (!isApplyingPreset) {
      state.preset = "custom";
      markPresetActive(state.preset);
    }
    schedule(applyPreview);
    if (initialSize <= MAX_IMAGE_BYTES) {
      setStatus(`Custom background image "${file.name}" added`, "success");
    }
    backgroundImageUpload.value = "";
  });
  reader.addEventListener("error", () => {
    backgroundImageUpload.value = "";
    setStatus("Could not read the selected file", "error");
  });
  reader.readAsDataURL(file);
});

backgroundImageClear.addEventListener("click", () => {
  delete state.background.imageData;
  uploadedImageMeta = null;
  updateBackgroundImageStatus();
  backgroundImageUpload.value = "";
  if (!isApplyingPreset) {
    state.preset = "custom";
    markPresetActive(state.preset);
  }
  schedule(applyPreview);
  setStatus("Removed uploaded image", "success");
});

backgroundBlurRange.addEventListener("input", () => {
  state.background.blur = Number(backgroundBlurRange.value);
  backgroundBlurValue.value = `${Math.round(state.background.blur)}px`;
  if (!isApplyingPreset) {
    state.preset = "custom";
    markPresetActive(state.preset);
  }
  schedule(applyPreview);
});

clockScaleRange.addEventListener("input", () => {
  state.clock.scale = Number(clockScaleRange.value);
  clockScaleValue.value = `${state.clock.scale.toFixed(2)}x`;
  if (!isApplyingPreset) {
    state.preset = "custom";
    markPresetActive(state.preset);
  }
  schedule(applyPreview);
});

rimWidthRange.addEventListener("input", () => {
  state.clock.rimWidth = Number(rimWidthRange.value);
  rimWidthValue.value = `${state.clock.rimWidth.toFixed(1)}px`;
  if (!isApplyingPreset) {
    state.preset = "custom";
    markPresetActive(state.preset);
  }
  schedule(applyPreview);
});

handWidthRange.addEventListener("input", () => {
  state.clock.handWidth = Number(handWidthRange.value);
  handWidthValue.value = `${state.clock.handWidth.toFixed(1)}px`;
  if (!isApplyingPreset) {
    state.preset = "custom";
    markPresetActive(state.preset);
  }
  schedule(applyPreview);
});

dotSizeRange.addEventListener("input", () => {
  state.clock.dotSize = Number(dotSizeRange.value);
  dotSizeValue.value = `${Math.round(state.clock.dotSize)}px`;
  if (!isApplyingPreset) {
    state.preset = "custom";
    markPresetActive(state.preset);
  }
  schedule(applyPreview);
});

const handleColorInput = (
  theme: "light" | "dark",
  key: keyof Palette,
  getter: () => string,
) => {
  handlePaletteChange(theme, key, getter());
  if (!isApplyingPreset) {
    state.preset = "custom";
    markPresetActive(state.preset);
  }
};

lightBackgroundInput.addEventListener("input", () => handleColorInput("light", "background", () => lightBackgroundInput.value));
lightFaceInput.addEventListener("input", () => handleColorInput("light", "face", () => lightFaceInput.value));
lightRimInput.addEventListener("input", () => handleColorInput("light", "rim", () => lightRimInput.value));
lightHandInput.addEventListener("input", () => handleColorInput("light", "hand", () => lightHandInput.value));
lightAccentInput.addEventListener("input", () => handleColorInput("light", "accent", () => lightAccentInput.value));

darkBackgroundInput.addEventListener("input", () => handleColorInput("dark", "background", () => darkBackgroundInput.value));
darkFaceInput.addEventListener("input", () => handleColorInput("dark", "face", () => darkFaceInput.value));
darkRimInput.addEventListener("input", () => handleColorInput("dark", "rim", () => darkRimInput.value));
darkHandInput.addEventListener("input", () => handleColorInput("dark", "hand", () => darkHandInput.value));
darkAccentInput.addEventListener("input", () => handleColorInput("dark", "accent", () => darkAccentInput.value));

searchEnabledInput.addEventListener("change", () => {
  state.search.enabled = searchEnabledInput.checked;
  updateSearchFieldState(state.search.enabled);
  schedule(applyPreview);
});

searchEngineSelect.addEventListener("change", () => {
  state.search.engine = searchEngineSelect.value as SearchEngine;
});

searchPlaceholderInput.addEventListener("input", () => {
  state.search.placeholder = searchPlaceholderInput.value;
});

searchTopInput.addEventListener("change", () => {
  if (searchTopInput.checked) {
    handleSearchPositionChange("top");
  }
});

searchBottomInput.addEventListener("change", () => {
  if (searchBottomInput.checked) {
    handleSearchPositionChange("bottom");
  }
});

weatherEnabledInput.addEventListener("change", () => {
  state.widgets.weather.enabled = weatherEnabledInput.checked;
  updateWeatherFieldState(state.widgets.weather.enabled);
  schedule(() => setStatus("Weather widget preference updated"));
});

weatherLocationInput.addEventListener("input", () => {
  state.widgets.weather.location = weatherLocationInput.value;
  schedule(() => setStatus("Weather location updated"));
});

weatherUnitSelect.addEventListener("change", () => {
  state.widgets.weather.unit = weatherUnitSelect.value as TemperatureUnit;
  schedule(() => setStatus("Weather unit updated"));
});

pomodoroEnabledInput.addEventListener("change", () => {
  state.widgets.pomodoro.enabled = pomodoroEnabledInput.checked;
  updatePomodoroFieldState(state.widgets.pomodoro.enabled);
  schedule(() => setStatus("Pomodoro widget preference updated"));
});

type PomodoroDurationKey = "focusMinutes" | "breakMinutes" | "longBreakMinutes" | "cyclesBeforeLongBreak";

const updatePomodoroDuration = (key: PomodoroDurationKey, input: HTMLInputElement, min: number, max: number) => {
  const raw = Number(input.value);
  const fallback = state.widgets.pomodoro[key];
  const next = Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : fallback;
  state.widgets.pomodoro[key] = next;
  input.value = next.toString();
  schedule(() => setStatus("Pomodoro durations updated"));
};

pomodoroFocusInput.addEventListener("input", () => {
  updatePomodoroDuration("focusMinutes", pomodoroFocusInput, 5, 90);
});

pomodoroBreakInput.addEventListener("input", () => {
  updatePomodoroDuration("breakMinutes", pomodoroBreakInput, 1, 45);
});

pomodoroLongBreakInput.addEventListener("input", () => {
  updatePomodoroDuration("longBreakMinutes", pomodoroLongBreakInput, 5, 60);
});

pomodoroCyclesInput.addEventListener("input", () => {
  updatePomodoroDuration("cyclesBeforeLongBreak", pomodoroCyclesInput, 1, 8);
});

tasksEnabledInput.addEventListener("change", () => {
  state.widgets.tasks.enabled = tasksEnabledInput.checked;
  updateTasksFieldState(state.widgets.tasks.enabled);
  schedule(() => setStatus("Tasks widget preference updated"));
});

// Notification settings handlers
pomodoroNotificationsEnabledInput.addEventListener("change", () => {
  state.widgets.pomodoro.notifications.enabled = pomodoroNotificationsEnabledInput.checked;
  updateNotificationFieldState(state.widgets.pomodoro.notifications.enabled);
  schedule(() => setStatus("Notification preference updated"));
});

pomodoroFocusTitleInput.addEventListener("input", () => {
  state.widgets.pomodoro.notifications.focusTitle = pomodoroFocusTitleInput.value;
});

pomodoroFocusBodyInput.addEventListener("input", () => {
  state.widgets.pomodoro.notifications.focusBody = pomodoroFocusBodyInput.value;
});

pomodoroShortBreakTitleInput.addEventListener("input", () => {
  state.widgets.pomodoro.notifications.shortBreakTitle = pomodoroShortBreakTitleInput.value;
});

pomodoroShortBreakBodyInput.addEventListener("input", () => {
  state.widgets.pomodoro.notifications.shortBreakBody = pomodoroShortBreakBodyInput.value;
});

pomodoroLongBreakTitleInput.addEventListener("input", () => {
  state.widgets.pomodoro.notifications.longBreakTitle = pomodoroLongBreakTitleInput.value;
});

pomodoroLongBreakBodyInput.addEventListener("input", () => {
  state.widgets.pomodoro.notifications.longBreakBody = pomodoroLongBreakBodyInput.value;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Saving...");
  try {
    const validated = mergeWithDefaults(state);
    const saved = await saveSettings(validated);
    syncForm(saved);
    setStatus("Preferences saved", "success");
  } catch (error) {
    console.error("Failed to save settings", error);
    setStatus("Failed to save settings", "error");
  }
});

resetButton.addEventListener("click", async () => {
  setStatus("Restoring defaults...");
  try {
    const defaults = clone(DEFAULT_SETTINGS);
    syncForm(defaults);
    await saveSettings(defaults);
    setStatus("Defaults restored", "success");
  } catch (error) {
    console.error("Failed to reset settings", error);
    setStatus("Could not reset settings", "error");
  }
});

const init = async () => {
  renderPresetChips();
  initSidebarNavigation();
  try {
    const stored = await loadSettings();
    syncForm(stored);
    setStatus("Loaded", "success");
  } catch (error) {
    console.error("Failed to load settings", error);
    syncForm(DEFAULT_SETTINGS);
    setStatus("Loaded defaults", "error");
  }
};

void init();
