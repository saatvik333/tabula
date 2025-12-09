type Rotation = readonly [number, number];

type SegmentSymbol = " " | "┘" | "└" | "┐" | "┌" | "-" | "|";

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
const configCache = new Map<string, CellConfig>();

const computeCellConfig = (digit: string, index: number): CellConfig => {
  const layout = DIGIT_LAYOUT[digit];
  const symbol = layout?.[index] ?? " ";
  return {
    rotation: ROTATIONS[symbol],
    active: symbol !== " ",
  };
};

export const getCellConfig = (digit: string, index: number): CellConfig => {
  const key = `${digit}:${index}`;
  let config = configCache.get(key);
  if (!config) {
    config = computeCellConfig(digit, index);
    configCache.set(key, config);
  }
  return config;
};

export const DIGIT_SIZE = 24;
