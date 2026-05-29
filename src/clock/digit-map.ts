type Rotation = readonly [number, number];

type SegmentSymbol = " " | "┘" | "└" | "┐" | "┌" | "-" | "|";

// ROTATIONS maps each box segment to the degrees of rotation for the hour hand
// and minute hand to make that segment visible. A space (' ') represents inactive
// cells where hands are positioned symmetrically facing inward at 135 degrees.
const ROTATIONS: Record<SegmentSymbol, Rotation> = {
  " ": [135, 135],
  "┘": [180, 270],
  "└": [0, 270],
  "┐": [90, 180],
  "┌": [0, 90],
  "-": [0, 180],
  "|": [90, 270],
} as const;

const DIGIT_LAYOUT: Record<string, readonly SegmentSymbol[]> = {
  "0": [
    "┌", "-", "-", "┐",
    "|", "┌", "┐", "|",
    "|", "|", "|", "|",
    "|", "|", "|", "|",
    "|", "└", "┘", "|",
    "└", "-", "-", "┘",
  ],
  "1": [
    "┌", "-", "┐", " ",
    "└", "┐", "|", " ",
    " ", "|", "|", " ",
    " ", "|", "|", " ",
    "┌", "┘", "└", "┐",
    "└", "-", "-", "┘",
  ],
  "2": [
    "┌", "-", "-", "┐",
    "└", "-", "┐", "|",
    "┌", "-", "┘", "|",
    "|", "┌", "-", "┘",
    "|", "└", "-", "┐",
    "└", "-", "-", "┘",
  ],
  "3": [
    "┌", "-", "-", "┐",
    "└", "-", "┐", "|",
    " ", "┌", "┘", "|",
    " ", "└", "┐", "|",
    "┌", "-", "┘", "|",
    "└", "-", "-", "┘",
  ],
  "4": [
    "┌", "┐", "┌", "┐",
    "|", "|", "|", "|",
    "|", "└", "┘", "|",
    "└", "-", "┐", "|",
    " ", " ", "|", "|",
    " ", " ", "└", "┘",
  ],
  "5": [
    "┌", "-", "-", "┐",
    "|", "┌", "-", "┘",
    "|", "└", "-", "┐",
    "└", "-", "┐", "|",
    "┌", "-", "┘", "|",
    "└", "-", "-", "┘",
  ],
  "6": [
    "┌", "-", "-", "┐",
    "|", "┌", "-", "┘",
    "|", "└", "-", "┐",
    "|", "┌", "┐", "|",
    "|", "└", "┘", "|",
    "└", "-", "-", "┘",
  ],
  "7": [
    "┌", "-", "-", "┐",
    "└", "-", "┐", "|",
    " ", " ", "|", "|",
    " ", " ", "|", "|",
    " ", " ", "|", "|",
    " ", " ", "└", "┘",
  ],
  "8": [
    "┌", "-", "-", "┐",
    "|", "┌", "┐", "|",
    "|", "└", "┘", "|",
    "|", "┌", "┐", "|",
    "|", "└", "┘", "|",
    "└", "-", "-", "┘",
  ],
  "9": [
    "┌", "-", "-", "┐",
    "|", "┌", "┐", "|",
    "|", "└", "┘", "|",
    "└", "-", "┐", "|",
    "┌", "-", "┘", "|",
    "└", "-", "-", "┘",
  ],
} as const;

export const getRotationForCell = (digit: string, index: number): Rotation => {
  const layout = DIGIT_LAYOUT[digit];
  const symbol = layout?.[index] ?? " ";
  return ROTATIONS[symbol];
};

export type CellConfig = {
  rotation: Rotation;
  active: boolean;
};

// Pre-computed cache for all digit configurations
// Key format: "digit:index" -> CellConfig
const computeCellConfig = (digit: string, index: number): CellConfig => {
  const layout = DIGIT_LAYOUT[digit];
  const symbol = layout?.[index] ?? " ";
  return {
    rotation: ROTATIONS[symbol],
    active: symbol !== " ",
  };
};

export const DIGIT_SIZE = 24;

// Eagerly pre-compute and cache all possible digit/index configurations
// to guarantee O(1) reads without runtime map mutation or garbage collection pressure.
const buildConfigCache = (): ReadonlyMap<string, CellConfig> => {
  const cache = new Map<string, CellConfig>();
  const digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  for (const digit of digits) {
    for (let index = 0; index < DIGIT_SIZE; index++) {
      const key = `${digit}:${index}`;
      cache.set(key, computeCellConfig(digit, index));
    }
  }
  return cache;
};

const configCache = buildConfigCache();

export const getCellConfig = (digit: string, index: number): CellConfig => {
  const key = `${digit}:${index}`;
  return configCache.get(key) ?? computeCellConfig(digit, index);
};
