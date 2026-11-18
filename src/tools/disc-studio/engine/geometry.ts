// The disc's measurements and the layer geometry: pixels per mm, the canvas size, the mask and
// guide radii, the band arc, a layer's box, toLocal and the hit test. No drawing here.
// Mirrors disc-studio.html (lines 131-218, 294-300, 519-527); the parity test in tests/disc-parity is the final judge.
import type { DiscSettings, Layer, TextLayer } from "./project";

const MM_PER_INCH = 25.4;
const HALF_TURN_DEGREES = 180;
// WHY: a text box is measured at font size 10 and divided back, so the canvas measuring gets
// enough digits; the extra 0.01 mm keeps the last glyph's edge inside the box.
export const TEXT_MEASURE_SCALE = 10;
const TEXT_WIDTH_PAD_MM = 0.01;
export const TEXT_LINE_HEIGHT = 1.15;
const DEFAULT_SAFE_MARGIN_MM = 4;
const SAFE_MARGIN_EXTRA_MM = 2; // safe line sits this far past the mask margin

export type Point = readonly [number, number];
export interface Box {
  width: number;
  height: number;
}
/** Ring radii in pixels. An `inner` of 0 means there is no hole ring. */
export interface Radii {
  outer: number;
  inner: number;
}

type SizeSettings = Pick<DiscSettings, "d" | "bleed" | "dpi">;
type MaskSettings = Pick<DiscSettings, "d" | "hole" | "bleed" | "dpi" | "margin">;
type Placement = Pick<Layer, "x" | "y" | "rot" | "flip">;

// #region Disc measurements
/** Two decimals: what the number fields show and what the wheel edits write. */
export function roundToHundredths(value: number): number {
  return Math.round(value * 100) / 100;
}

export function pxPerMm(dpi: number): number {
  return dpi / MM_PER_INCH;
}

export function canvasSize(settings: SizeSettings): number {
  return Math.round(pxPerMm(settings.dpi) * (settings.d + 2 * settings.bleed));
}

/** The cut shape with bleed: nothing is ever printed outside it. */
export function cutRadii(settings: MaskSettings): Radii {
  const pixels = pxPerMm(settings.dpi);
  return {
    outer: pixels * (settings.d / 2 + settings.bleed),
    inner: pixels * Math.max(0, settings.hole / 2 - settings.bleed),
  };
}

/** The built-in mask: pulled in by the margin, or the cut shape when the margin is 0. */
export function builtinMaskRadii(settings: MaskSettings): Radii {
  const pixels = pxPerMm(settings.dpi);
  const { d, hole, bleed, margin } = settings;
  const outer = margin > 0 ? pixels * (d / 2 - margin) : pixels * (d / 2 + bleed);
  if (hole <= 0) return { outer, inner: 0 };
  const inner =
    margin > 0 ? pixels * (hole / 2 + margin) : Math.max(0, pixels * (hole / 2 - bleed));
  return { outer, inner };
}

/**
 * The SVG path that cuts the band off the bottom of the built-in mask, or null with no band.
 * With a curve the top edge is an arc of the circle through the three points of the bow.
 */
export function bandArcPath(
  settings: Pick<DiscSettings, "d" | "bleed" | "dpi" | "band" | "curve">,
): string | null {
  if (settings.band <= 0) return null;
  const size = canvasSize(settings);
  const pixels = pxPerMm(settings.dpi);
  const peak = size / 2 + pixels * (settings.d / 2 - settings.band);
  const bow = pixels * settings.curve;
  const top = peak + bow;
  const arcRadius = ((size * size) / 4 + bow * bow) / (2 * bow);
  const edge = bow > 0 ? `A ${arcRadius} ${arcRadius} 0 0 1 ${size} ${top}` : `L ${size} ${top}`;
  return `M 0 ${top} ${edge} L ${size} ${size} L 0 ${size} Z`;
}

/** How far inside the cut the dashed safe lines run, in mm. */
export function safeMarginMm(settings: Pick<DiscSettings, "maskMode" | "margin">): number {
  const marginSet = settings.maskMode === "builtin" && settings.margin > 0;
  return marginSet ? settings.margin + SAFE_MARGIN_EXTRA_MM : DEFAULT_SAFE_MARGIN_MM;
}

/** The four guide circles, in pixels: the cut lines and the dashed safe lines. */
export function guideRadii(settings: MaskSettings & Pick<DiscSettings, "maskMode">): {
  cut: number;
  safe: number;
  hole: number;
  holeSafe: number;
} {
  const pixels = pxPerMm(settings.dpi);
  const safe = safeMarginMm(settings);
  return {
    cut: pixels * (settings.d / 2),
    safe: pixels * (settings.d / 2 - safe),
    hole: pixels * (settings.hole / 2),
    holeSafe: pixels * (settings.hole / 2 + safe),
  };
}
// #endregion

// #region Layer geometry
export interface BoxSource {
  /** The natural pixel size of an image. */
  imageNaturalSize(imageId: string): Box;
  /** Width in pixels of one text line, measured at font size TEXT_MEASURE_SCALE. */
  measureLine(layer: TextLayer, line: string): number;
}

/** A layer's width and height in mm, before rotation. */
export function layerBox(layer: Layer, source: BoxSource): Box {
  if (layer.type === "image") {
    // WHY: w * nh / nw, not w * (nh / nw): the HTML's order, which can differ in the last bit.
    const natural = source.imageNaturalSize(layer.img);
    return { width: layer.w, height: (layer.w * natural.height) / natural.width };
  }
  const lines = layer.text.split("\n");
  const widest = Math.max(...lines.map((line) => source.measureLine(layer, line)));
  return {
    width: widest / TEXT_MEASURE_SCALE + TEXT_WIDTH_PAD_MM,
    height: lines.length * layer.size * TEXT_LINE_HEIGHT,
  };
}

// The point as seen from the layer: moved to its centre, turned back, un-mirrored.
function intoLayerFrame(layer: Placement, point: Point): { x: number; y: number } {
  const angle = (-layer.rot * Math.PI) / HALF_TURN_DEGREES;
  const dx = point[0] - layer.x;
  const dy = point[1] - layer.y;
  return {
    x: dx * Math.cos(angle) - dy * Math.sin(angle),
    y: dx * Math.sin(angle) + dy * Math.cos(angle),
  };
}

/**
 * A point in mm from the disc centre, as eraser strokes store it: in the layer's own frame,
 * as a share of the layer's box width, so strokes move, turn and scale with the layer.
 */
export function toLocal(layer: Placement, point: Point, boxWidth: number): Point {
  const local = intoLayerFrame(layer, point);
  const x = layer.flip ? -local.x : local.x;
  return [x / boxWidth, local.y / boxWidth];
}

/** The topmost visible layer under the point (mm from the disc centre), or null. */
export function hitTest(
  layers: readonly Layer[],
  point: Point,
  boxOf: (layer: Layer) => Box,
): Layer | null {
  for (let index = layers.length - 1; index >= 0; index--) {
    const layer = layers[index];
    if (!layer?.visible) continue;
    const local = intoLayerFrame(layer, point);
    const { width, height } = boxOf(layer);
    if (Math.abs(local.x) <= width / 2 && Math.abs(local.y) <= height / 2) return layer;
  }
  return null;
}
// #endregion
