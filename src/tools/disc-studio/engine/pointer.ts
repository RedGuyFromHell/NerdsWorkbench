// The pointer on the disc canvas: where it is in mm, how far a drag moved a layer, what a wheel
// step does, and the listeners that wire those to a DiscDocument for the move, erase and restore
// tools. The key listener is here too.
// Mirrors disc-studio.html (lines 515-594); the parity test in tests/disc-parity judges the drawing, not this.
import { canvasSize, hitTest, pxPerMm, roundToHundredths, type Point } from "./geometry";
import type { DiscDocument } from "./document";
import { replaceLayer, selectLayer } from "./actions";
import {
  beginStroke,
  continueStroke,
  runKeyCommand,
  setBrush,
  type ActiveStroke,
} from "./toolActions";
import { ignoresKey, keyCommand } from "./keys";
import type { DiscSettings, Layer } from "./project";

const WHEEL_STEP = 1.03; // size grows or shrinks 3% a wheel step
const WHEEL_STEP_FINE = 1.005;
const ROTATE_STEP_DEGREES = 1;
const ROTATE_STEP_FINE_DEGREES = 0.1;
export const MIN_BRUSH_MM = 0.2;
const BRUSH_WHEEL_STEP = 1.1; // the brush grows or shrinks 10% a wheel step

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

/** The brush diameter in mm after one wheel step. */
export function brushAfterWheel(brushMm: number, direction: 1 | -1): number {
  return roundToHundredths(Math.max(MIN_BRUSH_MM, brushMm * Math.pow(BRUSH_WHEEL_STEP, direction)));
}
// #endregion

// #region Listeners
const CURSOR_GRAB = "grab";
const CURSOR_GRABBING = "grabbing";
const CURSOR_HIDDEN = "none"; // the brush outline is the cursor of the eraser tools

/** Puts the move, erase and restore tools on the canvas. Returns a function that takes the listeners off. */
export function attachPointer(canvas: HTMLCanvasElement, discDocument: DiscDocument): () => void {
  let grab: Grab | null = null;
  let stroke: ActiveStroke | null = null;

  const toMm = (event: MouseEvent): Point =>
    pointerToMm(
      [event.clientX, event.clientY],
      canvas.getBoundingClientRect(),
      discDocument.settings,
    );
  const layerAt = (point: Point): Layer | null =>
    hitTest(discDocument.layers, point, (layer) => discDocument.renderer.boxOf(layer));
  const idleCursor = (): string => (discDocument.tool === "move" ? "default" : CURSOR_HIDDEN);

  // The eraser works on the selected layer; with none selected, a press selects the layer under it.
  const startErasing = (event: PointerEvent, point: Point): void => {
    if (!discDocument.selected) selectLayer(discDocument, layerAt(point));
    const { selected } = discDocument;
    if (!selected) return;
    discDocument.beginGesture();
    stroke = beginStroke(discDocument, selected, point);
    canvas.setPointerCapture(event.pointerId);
  };

  const startDragging = (event: PointerEvent, point: Point): void => {
    const layer = layerAt(point);
    if (layer !== discDocument.selected) selectLayer(discDocument, layer);
    if (!layer) return;
    discDocument.beginGesture();
    grab = { x: layer.x, y: layer.y, pointer: point };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = CURSOR_GRABBING;
  };

  const onPointerDown = (event: PointerEvent): void => {
    const point = toMm(event);
    if (discDocument.tool === "move") startDragging(event, point);
    else startErasing(event, point);
  };

  const onPointerMove = (event: PointerEvent): void => {
    const point = toMm(event);
    discDocument.hover = point;
    if (stroke) {
      stroke = continueStroke(discDocument, stroke, point);
      return;
    }
    if (discDocument.tool !== "move") {
      discDocument.requestDraw(); // the brush outline follows the pointer
      return;
    }
    const { selected } = discDocument;
    if (grab && selected) {
      replaceLayer(discDocument, { ...selected, ...dragPosition(grab, point) });
      return;
    }
    canvas.style.cursor = layerAt(point) ? CURSOR_GRAB : "default";
  };

  // WHY: a gesture that never ended would merge every later change into one undo step, so a cancelled pointer ends it too.
  const onPointerUp = (): void => {
    discDocument.endGesture();
    grab = null;
    stroke = null;
    canvas.style.cursor = idleCursor();
  };

  const onPointerLeave = (): void => {
    discDocument.hover = null;
    discDocument.requestDraw();
  };

  const onWheel = (event: WheelEvent): void => {
    const direction = wheelDirection(event.deltaY);
    if (discDocument.tool !== "move") {
      event.preventDefault();
      setBrush(discDocument, brushAfterWheel(discDocument.brushMm, direction));
      return;
    }
    const { selected } = discDocument;
    if (!selected) return;
    event.preventDefault();
    replaceLayer(
      discDocument,
      wheelEdit(selected, { direction, rotate: event.shiftKey, fine: event.altKey }),
    );
  };

  // A tool picked by key or button changes the cursor without the pointer moving.
  const onDocumentChanged = (): void => {
    if (discDocument.tool !== "move") canvas.style.cursor = CURSOR_HIDDEN;
    else if (canvas.style.cursor === CURSOR_HIDDEN) canvas.style.cursor = "default";
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerLeave);
  // WHY: a wheel listener is passive unless it says otherwise, and a passive one cannot stop the scroll.
  canvas.addEventListener("wheel", onWheel, { passive: false });
  const unsubscribe = discDocument.subscribe(onDocumentChanged);
  return () => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    canvas.removeEventListener("wheel", onWheel);
    unsubscribe();
  };
}

/**
 * Puts the shortcut keys on the page. Tools stay mounted while hidden, so `isActive` says
 * whether Disc Studio is the one on screen. Returns a function that takes the listener off.
 */
export function attachKeys(discDocument: DiscDocument, isActive: () => boolean): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!isActive()) return;
    const command = keyCommand(event, discDocument.selected !== null);
    if (!command || ignoresKey(command, event.target)) return;
    // WHY: the arrows scroll, Backspace can go back, Ctrl+D bookmarks and Ctrl+Z undoes a field; a tool key does none of that.
    if (command.type !== "tool") event.preventDefault();
    runKeyCommand(discDocument, command);
  };
  document.addEventListener("keydown", onKeyDown);
  return () => document.removeEventListener("keydown", onKeyDown);
}
// #endregion
