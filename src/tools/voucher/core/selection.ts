// The code area on the template: draw, move and resize it with the pointer, and turn it into the
// template's own pixels. All maths is on plain rectangles in the displayed image's coordinates.
import { roundHalfToEven } from "./roundHalfToEven";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export type Corner = "nw" | "ne" | "sw" | "se";

export const CORNERS: readonly Corner[] = ["nw", "ne", "sw", "se"];

/** Smallest width and height a selection may have, in displayed pixels. */
export const MIN_SELECTION_SIZE = 8;

// #region Drawing and moving

export function drawSelection(start: Point, pointer: Point, bounds: Rect): Rect {
  const endX = Math.max(bounds.x, Math.min(bounds.x + bounds.width, pointer.x));
  const endY = Math.max(bounds.y, Math.min(bounds.y + bounds.height, pointer.y));
  return {
    x: Math.min(start.x, endX),
    y: Math.min(start.y, endY),
    width: Math.abs(endX - start.x),
    height: Math.abs(endY - start.y),
  };
}

export function isSelectionTooSmall(selection: Rect): boolean {
  return selection.width < MIN_SELECTION_SIZE || selection.height < MIN_SELECTION_SIZE;
}

export function moveSelection(original: Rect, offset: Point, bounds: Rect): Rect {
  return {
    ...original,
    x: clampStart(original.x + offset.x, original.width, bounds.x, bounds.width),
    y: clampStart(original.y + offset.y, original.height, bounds.y, bounds.height),
  };
}

// Pushes the near edge in first, then the far edge, so an oversized rectangle ends flush with
// the far edge.
function clampStart(start: number, length: number, boundsStart: number, boundsLength: number) {
  let clamped = Math.max(start, boundsStart);
  if (clamped + length > boundsStart + boundsLength) clamped = boundsStart + boundsLength - length;
  return clamped;
}

// #endregion

// #region Resizing by a corner

export function resizeSelection(
  original: Rect,
  corner: Corner,
  pointer: Point,
  bounds: Rect,
): Rect {
  const right = original.x + original.width;
  const bottom = original.y + original.height;
  let { x, y, width, height } = original;

  if (corner === "nw" || corner === "sw") {
    x = Math.min(pointer.x, right - MIN_SELECTION_SIZE);
    width = right - x;
  } else {
    width = Math.max(MIN_SELECTION_SIZE, pointer.x - original.x);
  }
  if (corner === "nw" || corner === "ne") {
    y = Math.min(pointer.y, bottom - MIN_SELECTION_SIZE);
    height = bottom - y;
  } else {
    height = Math.max(MIN_SELECTION_SIZE, pointer.y - original.y);
  }

  // WHY: the size is worked out before the position is clamped. A drag past the left or top edge
  // pins the near edge to the image but leaves the size as if it had gone outside, so the
  // opposite edge moves out.
  x = Math.max(bounds.x, x);
  y = Math.max(bounds.y, y);
  width = Math.min(width, bounds.x + bounds.width - x);
  height = Math.min(height, bounds.y + bounds.height - y);
  return { x, y, width, height };
}

// #endregion

// #region To the template's pixels

/** The selection as 0 to 1 of the displayed image, for the status bar and for a window resize. */
export function toFractions(selection: Rect, displayed: Rect): Rect {
  return {
    x: (selection.x - displayed.x) / displayed.width,
    y: (selection.y - displayed.y) / displayed.height,
    width: selection.width / displayed.width,
    height: selection.height / displayed.height,
  };
}

export function toImagePixels(selection: Rect, displayed: Rect, image: Size): Rect {
  const fractions = toFractions(selection, displayed);
  // WHY: an exact half goes to the even pixel, not up as Math.round would send it.
  return {
    x: roundHalfToEven(fractions.x * image.width),
    y: roundHalfToEven(fractions.y * image.height),
    width: roundHalfToEven(fractions.width * image.width),
    height: roundHalfToEven(fractions.height * image.height),
  };
}

// #endregion
