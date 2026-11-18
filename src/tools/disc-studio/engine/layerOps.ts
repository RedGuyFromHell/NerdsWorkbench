// What the layer list and the eraser do, as pure functions: reorder, copy, cover and fit, and
// the eraser stroke points. Each returns a new value and changes nothing it is given.
// Mirrors disc-studio.html (lines 336-342, 396-406, 551-557); the parity test in tests/disc-parity is the final judge.
import type { Point } from "./geometry";
import type { ImageLayer, Layer, Stroke } from "./project";

export const DUPLICATE_OFFSET_MM = 2;
// A new stroke point must be farther than this share of the brush radius from the last one.
export const STROKE_THINNING_FACTOR = 0.15;
const STROKE_POINT_PRECISION = 1e4; // points keep 4 decimals

// #region Layer list
function indexOfLayer(layers: readonly Layer[], layerId: number): number {
  const index = layers.findIndex((layer) => layer.id === layerId);
  if (index < 0) throw new Error(`No layer with id ${layerId}.`);
  return index;
}

/** Moves a layer one place: 1 is up (towards the end of the list), -1 is down. At an end, nothing moves. */
export function moveLayer(layers: readonly Layer[], layerId: number, direction: 1 | -1): Layer[] {
  const index = indexOfLayer(layers, layerId);
  const target = index + direction;
  const moved = [...layers];
  const [layer, neighbour] = [moved[index], moved[target]]; // no neighbour at an end
  if (layer && neighbour) [moved[index], moved[target]] = [neighbour, layer];
  return moved;
}

/** A copy of a layer, offset by 2 mm, with its own strokes, put right above the original. */
export function duplicateLayer(
  layers: readonly Layer[],
  layerId: number,
  newId: number,
): { layers: Layer[]; copy: Layer } {
  const index = indexOfLayer(layers, layerId);
  const original = layers[index] as Layer;
  const copy: Layer = {
    ...original,
    erase: structuredClone(original.erase ?? []),
    id: newId,
    name: `${original.name} copy`,
    x: original.x + DUPLICATE_OFFSET_MM,
    y: original.y + DUPLICATE_OFFSET_MM,
  };
  const copied = [...layers];
  copied.splice(index + 1, 0, copy);
  return { layers: copied, copy };
}
// #endregion

// #region Cover and fit
/** The width that fills the whole disc; `aspect` is natural width / natural height. */
export function coverWidth(aspect: number, discDiameter: number): number {
  return aspect >= 1 ? discDiameter * aspect : discDiameter;
}

/** The width that fits the whole image inside the disc. */
export function fitWidth(aspect: number, discDiameter: number): number {
  return aspect >= 1 ? discDiameter : discDiameter * aspect;
}

export function fitImageLayer(
  layer: ImageLayer,
  mode: "cover" | "fit",
  aspect: number,
  discDiameter: number,
): ImageLayer {
  const width =
    mode === "cover" ? coverWidth(aspect, discDiameter) : fitWidth(aspect, discDiameter);
  return { ...layer, w: width, x: 0, y: 0 };
}
// #endregion

// #region Nudge
const roundToHundredth = (value: number): number => Math.round(value * 100) / 100;

/** The layer moved by (dx, dy) mm, to hundredths so repeated 0.1 steps do not drift. */
export function nudgeLayer(layer: Layer, dx: number, dy: number): Layer {
  return { ...layer, x: roundToHundredth(layer.x + dx), y: roundToHundredth(layer.y + dy) };
}
// #endregion

// #region Eraser strokes
const roundStrokeCoordinate = (value: number): number =>
  Math.round(value * STROKE_POINT_PRECISION) / STROKE_POINT_PRECISION;

const roundStrokePoint = (point: Point): [number, number] => [
  roundStrokeCoordinate(point[0]),
  roundStrokeCoordinate(point[1]),
];

/** `point` is already in the layer's own units (see toLocal); `boxWidth` is the layer's width in mm. */
export function startStroke(options: {
  mode: Stroke["mode"];
  brushMm: number;
  soft: number;
  boxWidth: number;
  point: Point;
}): Stroke {
  return {
    mode: options.mode,
    r: options.brushMm / 2 / options.boxWidth,
    soft: options.soft,
    pts: [roundStrokePoint(options.point)],
  };
}

/** The stroke with the point added, or the same stroke when the point is too close to the last one. */
export function addStrokePoint(stroke: Stroke, point: Point): Stroke {
  const next = roundStrokePoint(point);
  const last = stroke.pts[stroke.pts.length - 1];
  const tooClose =
    last !== undefined &&
    Math.hypot(next[0] - last[0], next[1] - last[1]) <= stroke.r * STROKE_THINNING_FACTOR;
  return tooClose ? stroke : { ...stroke, pts: [...stroke.pts, next] };
}

/** The layer with the stroke added after its others. */
export function appendStroke(layer: Layer, stroke: Stroke): Layer {
  return { ...layer, erase: [...(layer.erase ?? []), stroke] };
}

/** The layer with its last stroke swapped for `stroke` (the stroke being drawn grows by points). */
export function replaceLastStroke(layer: Layer, stroke: Stroke): Layer {
  const strokes = layer.erase ?? [];
  if (strokes.length === 0) return layer;
  return { ...layer, erase: [...strokes.slice(0, -1), stroke] };
}

/** The layer without its last stroke: what Ctrl+Z does. */
export function undoStroke(layer: Layer): Layer {
  const strokes = layer.erase ?? [];
  if (strokes.length === 0) return layer;
  return { ...layer, erase: strokes.slice(0, -1) };
}

export function clearStrokes(layer: Layer): Layer {
  return { ...layer, erase: [] };
}
// #endregion
