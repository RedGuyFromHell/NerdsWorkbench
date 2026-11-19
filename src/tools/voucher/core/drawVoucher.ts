// Draws one code onto the template. The preview and the export call this same function, so what
// the user sees is what the file holds. Canvas work, checked by eye (the layout maths it relies
// on is `layoutCode`, which is tested).
import { layoutCode } from "./codeLayout";
import type { Rect } from "./selection";

export interface CodeStyle {
  fontFamily: string;
  fontSizePx: number;
  letterSpacingPx: number;
  /** A CSS colour: the user's own pick. */
  colour: string;
  outlineColour: string;
  /** 0 draws no outline. */
  outlineThicknessPx: number;
}

export interface VoucherDrawing {
  /** The template, drawn at its own size from the top left corner. */
  template: CanvasImageSource;
  templateWidth: number;
  templateHeight: number;
  /** Null draws the template alone. */
  code: string | null;
  style: CodeStyle;
  /** The code area, in the template's own pixels. Null draws the template alone. */
  area: Rect | null;
}

// WHY: the code is drawn bold; a font with no bold face gets the browser's synthetic bold.
const FONT_WEIGHT = "bold";

/** The CSS font shorthand for a family and size, with the family's quotes and backslashes removed. */
export function voucherFont(fontFamily: string, fontSizePx: number): string {
  const safeFamily = fontFamily.replace(/["\\]/g, "");
  return `${FONT_WEIGHT} ${fontSizePx}px "${safeFamily}"`;
}

/**
 * Waits until the browser can draw with this family. A font the browser cannot find would
 * otherwise draw in a fallback face without any error. System fonts resolve at once; the wait
 * matters for a font that is still being read.
 */
export async function loadVoucherFont(fontFamily: string): Promise<void> {
  await document.fonts.load(voucherFont(fontFamily, 12));
}

export function drawVoucher(context: CanvasRenderingContext2D, drawing: VoucherDrawing): void {
  const { template, templateWidth, templateHeight, code, style, area } = drawing;
  context.clearRect(0, 0, templateWidth, templateHeight);
  context.drawImage(template, 0, 0);
  if (code === null || code === "" || area === null) return;
  drawCode(context, code, style, area);
}

function drawCode(
  context: CanvasRenderingContext2D,
  code: string,
  style: CodeStyle,
  area: Rect,
): void {
  context.save();
  context.font = voucherFont(style.fontFamily, Math.max(style.fontSizePx, 1));
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  const glyphs = [...code];
  const metrics = context.measureText("Hg");
  const layout = layoutCode({
    glyphAdvances: glyphs.map((glyph) => context.measureText(glyph).width),
    letterSpacing: style.letterSpacingPx,
    area,
    ascent: metrics.fontBoundingBoxAscent,
    descent: metrics.fontBoundingBoxDescent,
  });

  // WHY: the outline of the whole code goes down first and the fill on top, as one outlined path
  // and then one filled path: a glyph's outline never cuts into its neighbour.
  if (style.outlineThicknessPx > 0) {
    context.lineWidth = style.outlineThicknessPx * 2;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.strokeStyle = style.outlineColour;
    glyphs.forEach((glyph, index) => {
      context.strokeText(glyph, layout.glyphX[index] ?? 0, layout.baselineY);
    });
  }
  context.fillStyle = style.colour;
  glyphs.forEach((glyph, index) => {
    context.fillText(glyph, layout.glyphX[index] ?? 0, layout.baselineY);
  });
  context.restore();
}
