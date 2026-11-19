// The status bar text of the Voucher screen: the code area's size as a percentage of the template,
// and the sample code, as the old app's status bar showed them.
import { roundHalfToEven } from "./roundHalfToEven";
import { toFractions, type Rect, type Size } from "./selection";

const PERCENT = 100;

export function formatPreviewStatus(
  selection: Rect | null,
  template: Size | null,
  sample: string,
): string {
  const parts: string[] = [];
  if (selection !== null && template !== null) {
    const fractions = toFractions(selection, { x: 0, y: 0, ...template });
    // WHY: Python's round, as for the pixels: 12.5 % shows as 12, not 13.
    const width = roundHalfToEven(fractions.width * PERCENT);
    const height = roundHalfToEven(fractions.height * PERCENT);
    parts.push(`▭ ${width}% × ${height}%`);
  }
  parts.push(`↳ sample: ${sample}`);
  return parts.join("   ");
}
