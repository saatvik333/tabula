import type { Settings } from "$src/settings/schema";

export const clone = <T>(value: T): T => {
  return structuredClone(value);
};

export const cloneSettings = (settings: Settings): Settings => {
  return structuredClone(settings);
};
