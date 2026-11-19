import { describe, expect, it } from "vitest";
import { dragSelection, finishDrag } from "./selectionDrag";

const TEMPLATE = { x: 0, y: 0, width: 1000, height: 800 };
const AREA = { x: 100, y: 100, width: 200, height: 80 };

describe("dragSelection", () => {
  it("draws a rectangle from the start to the pointer, whichever way the pointer goes", () => {
    const drag = { kind: "draw", start: { x: 300, y: 200 } } as const;
    expect(dragSelection(drag, { x: 100, y: 50 }, TEMPLATE)).toEqual({
      x: 100,
      y: 50,
      width: 200,
      height: 150,
    });
  });

  it("stops a drawn rectangle at the edge of the template", () => {
    const drag = { kind: "draw", start: { x: 900, y: 700 } } as const;
    expect(dragSelection(drag, { x: 1200, y: 900 }, TEMPLATE)).toEqual({
      x: 900,
      y: 700,
      width: 100,
      height: 100,
    });
  });

  it("moves the original by how far the pointer has travelled since the start", () => {
    const drag = { kind: "move", start: { x: 150, y: 120 }, original: AREA } as const;
    expect(dragSelection(drag, { x: 170, y: 100 }, TEMPLATE)).toEqual({
      x: 120,
      y: 80,
      width: 200,
      height: 80,
    });
  });

  it("resizes from the corner that was grabbed, keeping the opposite corner still", () => {
    const drag = { kind: "resize", corner: "se", original: AREA } as const;
    expect(dragSelection(drag, { x: 400, y: 300 }, TEMPLATE)).toEqual({
      x: 100,
      y: 100,
      width: 300,
      height: 200,
    });
  });
});

describe("finishDrag", () => {
  const DRAW = { kind: "draw", start: { x: 0, y: 0 } } as const;

  it("drops a drawn rectangle that is under 8 pixels on a side", () => {
    expect(finishDrag(DRAW, { x: 10, y: 10, width: 7, height: 50 })).toBeNull();
    expect(finishDrag(DRAW, { x: 10, y: 10, width: 50, height: 7 })).toBeNull();
  });

  it("keeps a drawn rectangle of 8 pixels or more", () => {
    const area = { x: 10, y: 10, width: 8, height: 8 };
    expect(finishDrag(DRAW, area)).toEqual(area);
  });

  it("keeps a moved or resized rectangle whatever its size", () => {
    const tiny = { x: 10, y: 10, width: 1, height: 1 };
    expect(finishDrag({ kind: "move", start: { x: 0, y: 0 }, original: tiny }, tiny)).toEqual(tiny);
  });
});
