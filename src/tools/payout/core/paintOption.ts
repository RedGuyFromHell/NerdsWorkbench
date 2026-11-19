// The paint level of a line, read from its option values, and the primed variant of the same
// product at the same size: a painted line takes its print price and its cost from that one.

import { toMatchKey } from "./matchText";
import type { RawOption, RawVariant } from "./rawOrder";
import type { PaintOption } from "./types";

export const PRIMED_VALUE = "Primed & Drybrushed";
export const PARTIAL_VALUE = "Partial Paint Job";
export const COMPLETE_VALUE = "Complete Paint Job";

const PAINT_OPTION_BY_VALUE: ReadonlyMap<string, Exclude<PaintOption, "none">> = new Map([
  [toMatchKey(PRIMED_VALUE), "primed"],
  [toMatchKey(PARTIAL_VALUE), "partial"],
  [toMatchKey(COMPLETE_VALUE), "complete"],
]);

function isPaintValue(option: RawOption): boolean {
  return PAINT_OPTION_BY_VALUE.has(toMatchKey(option.value));
}

function isSameOption(left: RawOption, right: RawOption): boolean {
  return (
    toMatchKey(left.name) === toMatchKey(right.name) &&
    toMatchKey(left.value) === toMatchKey(right.value)
  );
}

/**
 * The paint level among the options of a line or a variant, or "none".
 * WHY: the option is named differently from product to product, so only its value is read.
 */
export function resolvePaintOption(options: readonly RawOption[]): PaintOption {
  for (const option of options) {
    const paintOption = PAINT_OPTION_BY_VALUE.get(toMatchKey(option.value));
    if (paintOption !== undefined) return paintOption;
  }
  return "none";
}

/**
 * The primed variant with the same other option values (the same size) as the line. A primed
 * line gets its own variant. Null for a line with no paint option, or when the shop has no such variant.
 */
export function findPrimedSibling(
  lineOptions: readonly RawOption[],
  variants: readonly RawVariant[],
): RawVariant | null {
  const otherOptions = lineOptions.filter((option) => !isPaintValue(option));
  if (otherOptions.length === lineOptions.length) return null;
  const sibling = variants.find(
    (variant) =>
      resolvePaintOption(variant.options) === "primed" &&
      otherOptions.every((option) =>
        variant.options.some((variantOption) => isSameOption(variantOption, option)),
      ),
  );
  return sibling ?? null;
}
