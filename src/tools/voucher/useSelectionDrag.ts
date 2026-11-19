// The pointer handlers of the preview overlay: they draw, move and resize the code area. The
// maths of each drag is `dragSelection` and `finishDrag`; this holds the gesture between events.
import { useRef, type PointerEvent, type RefObject } from "react";
import { CORNERS, type Corner, type Point, type Rect } from "./core/selection";
import { dragSelection, finishDrag, type Drag } from "./core/selectionDrag";
import { templateBounds, type VoucherTemplate } from "./template";

function asCorner(target: EventTarget): Corner | null {
  const corner = target instanceof HTMLElement ? target.dataset.corner : undefined;
  return CORNERS.find((candidate) => candidate === corner) ?? null;
}

function contains(area: Rect, point: Point): boolean {
  return (
    point.x >= area.x &&
    point.x <= area.x + area.width &&
    point.y >= area.y &&
    point.y <= area.y + area.height
  );
}

interface SelectionDragOptions {
  /** The canvas the pointer is measured against. */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  template: VoucherTemplate | null;
  selection: Rect | null;
  onSelectionChange(selection: Rect | null): void;
}

export function useSelectionDrag({
  canvasRef,
  template,
  selection,
  onSelectionChange,
}: SelectionDragOptions) {
  const dragRef = useRef<{ drag: Drag; latest: Rect | null } | null>(null);

  // The pointer in the template's pixels, whatever size CSS shows the canvas at.
  function toTemplatePoint(event: PointerEvent): Point | null {
    const box = canvasRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0 || template === null) return null;
    return {
      x: ((event.clientX - box.left) * template.width) / box.width,
      y: ((event.clientY - box.top) * template.height) / box.height,
    };
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const point = toTemplatePoint(event);
    if (!point) return;
    const corner = asCorner(event.target);
    let drag: Drag;
    if (selection && corner) drag = { kind: "resize", corner, original: selection };
    else if (selection && contains(selection, point)) {
      drag = { kind: "move", start: point, original: selection };
    } else {
      drag = { kind: "draw", start: point };
      onSelectionChange(null);
    }
    // A new rectangle starts empty: a click that never moves must not bring the old one back.
    dragRef.current = { drag, latest: drag.kind === "draw" ? null : selection };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function continueDrag(event: PointerEvent) {
    const active = dragRef.current;
    const point = toTemplatePoint(event);
    if (!active || !point || template === null) return;
    active.latest = dragSelection(active.drag, point, templateBounds(template));
    onSelectionChange(active.latest);
  }

  // WHY: also runs when the browser takes the pointer away (a lost capture), so a drag never hangs on.
  function endDrag() {
    const active = dragRef.current;
    dragRef.current = null;
    if (active?.latest) onSelectionChange(finishDrag(active.drag, active.latest));
  }

  return {
    onPointerDown: startDrag,
    onPointerMove: continueDrag,
    onPointerUp: endDrag,
    onLostPointerCapture: endDrag,
  };
}
