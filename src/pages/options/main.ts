import { DEFAULT_SETTINGS, mergeWithDefaults } from "$src/settings/defaults";
import { applySettingsToDocument } from "$src/settings/apply";
import type {
  Settings,
  ThemeMode,
  BackgroundType,
  SearchEngine,
  SearchPosition,
  PresetName,
  Palette,
  PinnedTab,
  TimeFormat,
} from "$src/settings/schema";
import { applyPresetToSettings, listAvailablePresets } from "$src/settings/presets";
import { loadSettings, saveSettings } from "$src/settings/storage";
import { getSystemPrefersDark, resolveTheme } from "$src/settings/theme";

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
const timeFormat24Input = getElement<HTMLInputElement>("timeFormat24");
const timeFormat12Input = getElement<HTMLInputElement>("timeFormat12");

const backgroundTypeColor = getElement<HTMLInputElement>("backgroundTypeColor");
const backgroundTypeImage = getElement<HTMLInputElement>("backgroundTypeImage");
const backgroundColorInput = getElement<HTMLInputElement>("backgroundColor");
const backgroundImageInput = getElement<HTMLInputElement>("backgroundImage");
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
const presetContainer = getElement<HTMLDivElement>("presetChips");
const pinnedListContainer = getElement<HTMLDivElement>("pinnedList");
const pinnedEmptyState = getElement<HTMLParagraphElement>("pinnedEmpty");
const pinnedAddTitleInput = getElement<HTMLInputElement>("pinnedAddTitle");
const pinnedAddUrlInput = getElement<HTMLInputElement>("pinnedAddUrl");
const pinnedAddIconInput = getElement<HTMLInputElement>("pinnedAddIcon");
const pinnedAddButton = getElement<HTMLButtonElement>("pinnedAddButton");

const setStatus = (text: string, tone: "default" | "success" | "error" = "default") => {
  statusEl.textContent = text;
  statusEl.dataset["tone"] = tone;
};

let previewHandle = 0;
let isApplyingPreset = false;
let presetButtons: HTMLButtonElement[] = [];

const MAX_PINNED_TABS = 12;

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
  document.body.dataset["backgroundType"] = state.background.type;
};

const updateRangeOutputs = () => {
  clockScaleValue.value = `${state.clock.scale.toFixed(2)}x`;
  rimWidthValue.value = `${state.clock.rimWidth.toFixed(1)}px`;
  handWidthValue.value = `${state.clock.handWidth.toFixed(1)}px`;
  dotSizeValue.value = `${Math.round(state.clock.dotSize)}px`;
  backgroundBlurValue.value = `${Math.round(state.background.blur)}px`;
};

const updateSearchFieldState = (enabled: boolean) => {
  [searchEngineSelect, searchPlaceholderInput, searchTopInput, searchBottomInput].forEach((element) => {
    element.disabled = !enabled;
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

function updatePinnedTab(id: string, updater: (tab: PinnedTab) => PinnedTab): void {
  state.pinnedTabs = state.pinnedTabs.map((tab) => (tab.id === id ? updater(tab) : tab));
}

function renderPinnedList(): void {
  const fragment = document.createDocumentFragment();

  if (state.pinnedTabs.length === 0) {
    pinnedEmptyState.hidden = false;
    fragment.append(pinnedEmptyState);
  } else {
    pinnedEmptyState.hidden = true;

    state.pinnedTabs.forEach((tab, index) => {
      const item = document.createElement("div");
      item.className = "pinned-item";
      item.dataset["id"] = tab.id;

      const preview = document.createElement("div");
      preview.className = "pinned-item__preview";

      const iconWrapper = document.createElement("span");
      iconWrapper.className = "pinned-item__icon";

      const titleLabel = document.createElement("span");
      titleLabel.className = "pinned-item__title";

      let currentTitle = tab.title;
      let currentIcon = tab.icon ?? "";
      let currentUrl = tab.url;

      const refreshPreview = () => {
        titleLabel.textContent = currentTitle || currentUrl;
        iconWrapper.innerHTML = "";
        if (currentIcon) {
          const iconImage = document.createElement("img");
          iconImage.className = "pinned-item__icon-image";
          iconImage.src = currentIcon;
          iconImage.alt = "";
          iconImage.loading = "lazy";
          iconWrapper.append(iconImage);
        } else {
          const fallback = document.createElement("span");
          fallback.className = "pinned-item__icon-fallback";
          const seed = (currentTitle || currentUrl).trim();
          fallback.textContent = seed.charAt(0).toUpperCase() || "•";
          iconWrapper.append(fallback);
        }
      };

      refreshPreview();

      preview.append(iconWrapper, titleLabel);

      const inputs = document.createElement("div");
      inputs.className = "pinned-item__inputs";

      const titleInput = document.createElement("input");
      titleInput.className = "pinned-item__input";
      titleInput.value = tab.title;
      titleInput.placeholder = "Title";
      titleInput.setAttribute("aria-label", "Pinned tab title");
      titleInput.maxLength = 40;

      titleInput.addEventListener("input", () => {
        currentTitle = titleInput.value;
        updatePinnedTab(tab.id, (prev) => ({ ...prev, title: titleInput.value }));
        refreshPreview();
      });

      const urlInput = document.createElement("input");
      urlInput.className = "pinned-item__input";
      urlInput.type = "url";
      urlInput.value = tab.url;
      urlInput.placeholder = "https://example.com";
      urlInput.setAttribute("aria-label", "Pinned tab URL");

      urlInput.addEventListener("input", () => {
        currentUrl = urlInput.value;
        updatePinnedTab(tab.id, (prev) => ({ ...prev, url: urlInput.value }));
        if (!currentTitle) {
          refreshPreview();
        }
      });

      const iconInput = document.createElement("input");
      iconInput.className = "pinned-item__input";
      iconInput.type = "url";
      iconInput.value = tab.icon ?? "";
      iconInput.placeholder = "Icon URL";
      iconInput.setAttribute("aria-label", "Pinned tab icon URL");

      iconInput.addEventListener("input", () => {
        const iconValue = iconInput.value.trim();
        currentIcon = iconValue;
        updatePinnedTab(tab.id, (prev) => {
          if (iconValue) {
            return { ...prev, icon: iconValue };
          }
          const { icon: _removed, ...rest } = prev;
          return rest;
        });
        refreshPreview();
      });

      inputs.append(titleInput, urlInput, iconInput);

      const actions = document.createElement("div");
      actions.className = "pinned-item__actions";

      const upButton = document.createElement("button");
      upButton.type = "button";
      upButton.className = "pinned-item__action";
      upButton.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">arrow_upward</span>';
      upButton.setAttribute("aria-label", "Move pinned tab up");
      upButton.disabled = index === 0;
      upButton.addEventListener("click", () => {
        movePinnedTab(tab.id, -1);
      });

      const downButton = document.createElement("button");
      downButton.type = "button";
      downButton.className = "pinned-item__action";
      downButton.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">arrow_downward</span>';
      downButton.setAttribute("aria-label", "Move pinned tab down");
      downButton.disabled = index === state.pinnedTabs.length - 1;
      downButton.addEventListener("click", () => {
        movePinnedTab(tab.id, 1);
      });

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "pinned-item__action pinned-item__action--remove";
      removeButton.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">delete</span>';
      removeButton.setAttribute("aria-label", "Remove pinned tab");
      removeButton.addEventListener("click", () => {
        removePinnedTab(tab.id);
      });

      actions.append(upButton, downButton, removeButton);

      item.append(preview, inputs, actions);
      fragment.append(item);
    });
  }

  pinnedListContainer.replaceChildren(fragment);
  pinnedAddButton.disabled = state.pinnedTabs.length >= MAX_PINNED_TABS;
  if (pinnedAddButton.disabled) {
    pinnedAddButton.title = "Maximum pinned tabs reached";
  } else {
    pinnedAddButton.removeAttribute("title");
  }
}

function movePinnedTab(id: string, direction: -1 | 1): void {
  const index = state.pinnedTabs.findIndex((tab) => tab.id === id);
  if (index < 0) return;
  const target = index + direction;
  if (target < 0 || target >= state.pinnedTabs.length) return;
  const tabs = [...state.pinnedTabs];
  const [entry] = tabs.splice(index, 1);
  if (!entry) {
    return;
  }
  tabs.splice(target, 0, entry);
  state.pinnedTabs = tabs;
  renderPinnedList();
  setStatus("Pinned tabs reordered", "success");
}

function removePinnedTab(id: string): void {
  state.pinnedTabs = state.pinnedTabs.filter((tab) => tab.id !== id);
  renderPinnedList();
  setStatus("Pinned tab removed", "success");
}

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
  if (state.clock.format === "12h") {
    timeFormat12Input.checked = true;
  } else {
    timeFormat24Input.checked = true;
  }

  const backgroundType = state.background.type;
  backgroundTypeColor.checked = backgroundType === "color";
  backgroundTypeImage.checked = backgroundType === "image";
  backgroundColorInput.value = state.background.color;
  backgroundImageInput.value = state.background.imageUrl;
  backgroundBlurRange.value = state.background.blur.toString();

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

  updateRangeOutputs();
  updateSearchFieldState(state.search.enabled);
  renderPinnedList();
  applyPreview();
  markPresetActive(state.preset ?? "custom");
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

const handleBackgroundTypeChange = (type: BackgroundType) => {
  state.background.type = type;
  document.body.dataset["backgroundType"] = type;
  if (!isApplyingPreset) {
    state.preset = "custom";
    markPresetActive(state.preset);
  }
  schedule(() => {
    applyPreview();
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

backgroundTypeColor.addEventListener("change", () => handleBackgroundTypeChange("color"));
backgroundTypeImage.addEventListener("change", () => handleBackgroundTypeChange("image"));

backgroundColorInput.addEventListener("input", () => {
  state.background.color = backgroundColorInput.value;
  if (!isApplyingPreset) {
    state.preset = "custom";
    markPresetActive(state.preset);
  }
  schedule(applyPreview);
});

backgroundImageInput.addEventListener("input", () => {
  state.background.imageUrl = backgroundImageInput.value.trim();
  if (!isApplyingPreset) {
    state.preset = "custom";
    markPresetActive(state.preset);
  }
  schedule(applyPreview);
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

pinnedAddButton.addEventListener("click", () => {
  if (state.pinnedTabs.length >= MAX_PINNED_TABS) {
    setStatus("Pinned tabs limit reached", "error");
    return;
  }

  const titleRaw = pinnedAddTitleInput.value.trim();
  const url = pinnedAddUrlInput.value.trim();
  const icon = pinnedAddIconInput.value.trim();

  if (!url) {
    setStatus("Enter a valid URL", "error");
    return;
  }

  if (!isValidPinnedUrl(url)) {
    setStatus("Enter a valid URL starting with http or https", "error");
    return;
  }

  let title = titleRaw;
  if (!title) {
    try {
      const parsed = new URL(url);
      title = parsed.hostname.replace(/^www\./i, "") || parsed.hostname;
    } catch {
      title = url;
    }
  }

  const id = generatePinnedId();
  const next: PinnedTab = icon
    ? { id, title, url, icon }
    : { id, title, url };

  state.pinnedTabs = [...state.pinnedTabs, next];
  pinnedAddTitleInput.value = "";
  pinnedAddUrlInput.value = "";
  pinnedAddIconInput.value = "";
  pinnedAddTitleInput.focus();
  renderPinnedList();
  setStatus("Pinned tab added", "success");
});

[pinnedAddTitleInput, pinnedAddUrlInput, pinnedAddIconInput].forEach((input) => {
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      pinnedAddButton.click();
    }
  });
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
