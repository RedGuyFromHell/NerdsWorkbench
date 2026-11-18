// What a number field decides about the text typed into it: when it counts as a value, and where it clamps.

function parseTyped(text: string): number | null {
  if (text.trim() === "") return null;
  const parsed = Number(text);
  return Number.isNaN(parsed) ? null : parsed;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The number to report while the user is still typing: only a number already inside the range.
 * WHY: clamping every keystroke turns "0" into the minimum 0.2, so "0.5" could never be typed.
 */
export function inRangeNumber(text: string, min: number, max: number): number | null {
  const parsed = parseTyped(text);
  return parsed !== null && parsed >= min && parsed <= max ? parsed : null;
}

/** The number to report when typing ends (blur or Enter): whatever was typed, clamped to the range. */
export function clampedNumber(text: string, min: number, max: number): number | null {
  const parsed = parseTyped(text);
  return parsed === null ? null : clamp(parsed, min, max);
}
