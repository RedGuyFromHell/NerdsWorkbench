// The pointer on the disc canvas: where it is in mm, how far a drag moved a layer, what a wheel
// step does, and the listeners that wire those to a DiscDocument for the move tool.
// Mirrors disc-studio.html (lines 515-578, move part); S2.2's parity test judges the drawing, not this.
import { canvasSize, hitTest, pxPerMm, type Point } from "./geometry";
import type { DiscDocument } from "./document";
import { replaceLayer, selectLayer } from "./actions";
import type { DiscSettings, Layer } from "./project";

const WHEEL_STEP = 1.03; // size grows or shrinks 3% a wheel step
const WHEEL_STEP_FINE = 1.005;
const ROTATE_STEP_DEGREES = 1;
const ROTATE_STEP_FINE_DEGREES = 0.1;

export interface PageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Grab {
  x: number; // the layer's position when it was grabbed, mm
  y: number;
  pointer: Point; // the pointer's position then, mm from the disc centre
}

export interface WheelInput {
  direction: 1 | -1;
  rotate: boolean;
  fine: boolean;
}

// #region Pointer maths
export function roundToHundredths(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A page position as mm from the disc centre, given where and how big the canvas is shown. */
export function pointerToMm(
  client: Point,
  rect: PageRect,
  settings: Pick<DiscSettings, "d" | "bleed" | "dpi">,
): Point {
  const size = canvasSize(settings);
  const pixels = pxPerMm(settings.dpi);
  return [
    (((client[0] - rect.left) / rect.width) * size - size / 2) / pixels,
    (((client[1] - rect.top) / rect.height) * size - size / 2) / pixels,
  ];
}

/** Where a grabbed layer goes: its old place, moved by how far the pointer has travelled. */
export function dragPosition(grab: Grab, pointer: Point): { x: number; y: number } {
  return { x: grab.x + pointer[0] - grab.pointer[0], y: grab.y + pointer[1] - grab.pointer[1] };
}

export function wheelDirection(deltaY: number): 1 | -1 {
  return deltaY < 0 ? 1 : -1;
}

/** The layer after one wheel step: turned, or an image's width / a text's size scaled. */
export function wheelEdit(layer: Layer, input: WheelInput): Layer {
  if (input.rotate) {
    const degrees = input.fine ? ROTATE_STEP_FINE_DEGREES : ROTATE_STEP_DEGREES;
    return { ...layer, rot: roundToHundredths(layer.rot + input.direction * degrees) };
  }
  const factor = Math.pow(input.fine ? WHEEL_STEP_FINE : WHEEL_STEP, input.direction);
  if (layer.type === "image") return { ...layer, w: layer.w * factor };
  return { ...layer, size: layer.size * factor };
}
// #endregion

// #region Listeners
const CURSOR_GRAB = "grab";
const CURSOR_GRABBING = "grabbing";

/** Puts the move tool on the canvas. Returns a function that takes the listeners off again. */
export function attachPointer(canvas: HTMLCanvasElement, discDocument: DiscDocument): () => void {
  let grab: Grab | null = null;

  const toMm = (event: MouseEvent): Point =>
    pointerToMm(
      [event.clientX, event.clientY],
      canvas.getBoundingClientRect(),
      discDocument.settings,
    );
  const layerAt = (point: Point): Layer | null =>
    hitTest(discDocument.layers, point, (layer) => discDocument.renderer.boxOf(layer));

  const onPointerDown = (event: PointerEvent): void => {
    // TODO: the eraser and restore tools take over pointer events here.
    if (discDocument.tool !== "move") return;
    const point = toMm(event);
    const layer = layerAt(point);
    if (layer !== discDocument.selected) selectLayer(discDocument, layer);
    if (!layer) return;
    grab = { x: layer.x, y: layer.y, pointer: point };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = CURSOR_GRABBING;
  };

  const onPointerMove = (event: PointerEvent): void => {
    const point = toMm(event);
    discDocument.hover = point;
    if (discDocument.tool !== "move") return;
    const { selected } = discDocument;
    if (grab && selected) {
      replaceLayer(discDocument, { ...selected, ...dragPosition(grab, point) });
      return;
    }
    canvas.style.cursor = layerAt(point) ? CURSOR_GRAB : "default";
  };

  const onPointerUp = (): void => {
    grab = null;
    canvas.style.cursor = "default";
  };

  const onPointerLeave = (): void => {
    discDocument.hover = null;
    discDocument.requestDraw();
  };

  const onWheel = (event: WheelEvent): void => {
    const { selected } = discDocument;
    if (discDocument.tool !== "move" || !selected) return;
    event.preventDefault();
    const direction = wheelDirection(event.deltaY);
    replaceLayer(
      discDocument,
      wheelEdit(selected, { direction, rotate: event.shiftKey, fine: event.altKey }),
    );
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerLeave);
  // WHY: a wheel listener is passive unless it says otherwise, and a passive one cannot stop the scroll.
  canvas.addEventListener("wheel", onWheel, { passive: false });
  return () => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    canvas.removeEventListener("wheel", onWheel);
  };
}
// #endregion
