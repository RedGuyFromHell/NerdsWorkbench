// Where each glyph of a code goes inside the selected area. Export and preview both lay text out
// glyph by glyph, because canvas letter spacing is not the spacing the user set.
import type { Rect } from "./selection";

export interface CodeLayoutInput {
  /** The width of each glyph on its own, in order. */
  glyphAdvances: readonly number[];
  letterSpacing: number;
  area: Rect;
  ascent: number;
  descent: number;
}

export interface CodeLayout {
  /** Left edge of each glyph. */
  glyphX: number[];
  baselineY: number;
  totalWidth: number;
}

export function layoutCode(input: CodeLayoutInput): CodeLayout {
  const { glyphAdvances, letterSpacing, area, ascent, descent } = input;
  const gapCount = Math.max(0, glyphAdvances.length - 1);
  const advanceSum = glyphAdvances.reduce((sum, advance) => sum + advance, 0);
  const totalWidth = advanceSum + letterSpacing * gapCount;

  // WHY: Math.floor rounds towards minus infinity for both the centre and the baseline;
  // Math.round would shift the text by a pixel on every odd gap.
  const left = area.x + Math.floor((area.width - totalWidth) / 2);
  const baselineY = area.y + Math.floor((area.height + ascent - descent) / 2);

  const glyphX: number[] = [];
  let cursor = left;
  for (const advance of glyphAdvances) {
    glyphX.push(cursor);
    cursor += advance + letterSpacing;
  }
  return { glyphX, baselineY, totalWidth };
}
