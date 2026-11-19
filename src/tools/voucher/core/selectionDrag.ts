// One pointer drag on the preview: what the code area is while the pointer is down, and what is
// left of it when the pointer is let go. The maths is `selection.ts`; this picks which part to
// call. All points and rectangles are in the template's own pixels.
import {
  drawSelection,
  isSelectionTooSmall,
  moveSelection,
  resizeSelection,
  type Corner,
  type Point,
  type Rect,
} from "./selection";

export type Drag =
  | { kind: "draw"; start: Point }
  | { kind: "move"; start: Point; original: Rect }
  | { kind: "resize"; corner: Corner; original: Rect };

/** The code area while the pointer is at `pointer`. `bounds` is the whole template. */
export function dragSelection(drag: Drag, pointer: Point, bounds: Rect): Rect {
  switch (drag.kind) {
    case "draw":
      return drawSelection(drag.start, pointer, bounds);
    case "move":
      return moveSelection(
        drag.original,
        { x: pointer.x - drag.start.x, y: pointer.y - drag.start.y },
        bounds,
      );
    case "resize":
      return resizeSelection(drag.original, drag.corner, pointer, bounds);
  }
}

/** The code area once the pointer is let go: a newly drawn one that is too small to use is dropped. */
export function finishDrag(drag: Drag, selection: Rect): Rect | null {
  return drag.kind === "draw" && isSelectionTooSmall(selection) ? null : selection;
}
