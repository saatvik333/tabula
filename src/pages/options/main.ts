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

const setStatus = (text: string, tone: "default" | "success" | "error" = "default") => {
  statusEl.textContent = text;
  statusEl.dataset["tone"] = tone;
};

let previewHandle = 0;
let isApplyingPreset = false;
let presetButtons: HTMLButtonElement[] = [];

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
