// What a number field decides about the text typed into it: when it counts as a value, how it is
// rounded, and what the field settles on when typing ends.

/** The range of a number field, and how many decimal places it reports (undefined: as typed). */
export interface NumberLimits {
  min: number;
  max: number;
  decimals?: number;
}

// WHY: a Romanian keyboard's number pad types "," for the decimal point. Only one comma and no
// point is read that way: "1,234.5" could mean two things, so it is not a number here.
function parseTyped(text: string): number | null {
  if (text.trim() === "") return null;
  const parsed = Number(text.includes(".") ? text : text.replace(",", "."));
  return Number.isNaN(parsed) ? null : parsed;
}

function roundTo(value: number, decimals: number | undefined): number {
  if (decimals === undefined) return value;
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The number to report while the user is still typing: only a number already inside the range,
 * rounded to `decimals` places when that is given.
 * WHY: clamping every keystroke turns "0" into the minimum 0.2, so "0.5" could never be typed.
 */
export function inRangeNumber(
  text: string,
  min: number,
  max: number,
  decimals?: number,
): number | null {
  const parsed = parseTyped(text);
  if (parsed === null) return null;
  const rounded = roundTo(parsed, decimals);
  return rounded >= min && rounded <= max ? rounded : null;
}

/**
 * The number the field shows when typing ends (blur or Enter): what was typed when it is inside
 * the range, else the last valid value.
 * WARNING: never the nearest end of the range. A slip of the finger ("1000" for 10 %) would
 * become the maximum, and the maximum of a percentage is 100 % off.
 */
export function settledNumber(text: string, lastValid: number, limits: NumberLimits): number {
  return inRangeNumber(text, limits.min, limits.max, limits.decimals) ?? lastValid;
}

/** Whatever was typed, clamped to the range. */
export function clampedNumber(text: string, min: number, max: number): number | null {
  const parsed = parseTyped(text);
  return parsed === null ? null : clamp(parsed, min, max);
}
