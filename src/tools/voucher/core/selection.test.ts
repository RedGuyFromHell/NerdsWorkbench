import { describe, expect, it } from "vitest";
import {
  drawSelection,
  isSelectionTooSmall,
  moveSelection,
  resizeSelection,
  toFractions,
  toImagePixels,
  type Rect,
} from "./selection";

const IMAGE_BOUNDS: Rect = { x: 0, y: 0, width: 200, height: 100 };

describe("drawSelection", () => {
  it("builds the rectangle between the start and the pointer", () => {
    expect(drawSelection({ x: 20, y: 30 }, { x: 60, y: 50 }, IMAGE_BOUNDS)).toEqual({
      x: 20,
      y: 30,
      width: 40,
      height: 20,
    });
  });

  it("normalises a drag that goes up and to the left", () => {
    expect(drawSelection({ x: 60, y: 50 }, { x: 20, y: 30 }, IMAGE_BOUNDS)).toEqual({
      x: 20,
      y: 30,
      width: 40,
      height: 20,
    });
  });

  it("clamps the pointer to the image on every side", () => {
    expect(drawSelection({ x: 50, y: 50 }, { x: 999, y: 999 }, IMAGE_BOUNDS)).toEqual({
      x: 50,
      y: 50,
      width: 150,
      height: 50,
    });
    expect(drawSelection({ x: 50, y: 50 }, { x: -40, y: -40 }, IMAGE_BOUNDS)).toEqual({
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    });
  });

  it("keeps the offset of an image that does not start at the origin", () => {
    const shifted: Rect = { x: 10, y: 20, width: 100, height: 100 };

    expect(drawSelection({ x: 50, y: 50 }, { x: 5, y: 500 }, shifted)).toEqual({
      x: 10,
      y: 50,
      width: 40,
      height: 70,
    });
  });
});

describe("isSelectionTooSmall", () => {
  it("rejects a width or a height under 8 pixels", () => {
    expect(isSelectionTooSmall({ x: 0, y: 0, width: 7.9, height: 50 })).toBe(true);
    expect(isSelectionTooSmall({ x: 0, y: 0, width: 50, height: 7.9 })).toBe(true);
  });

  it("accepts exactly 8 pixels", () => {
    expect(isSelectionTooSmall({ x: 0, y: 0, width: 8, height: 8 })).toBe(false);
  });
});

describe("moveSelection", () => {
  const original: Rect = { x: 50, y: 30, width: 40, height: 20 };

  it("moves the rectangle by the pointer offset", () => {
    expect(moveSelection(original, { x: 10, y: -5 }, IMAGE_BOUNDS)).toEqual({
      x: 60,
      y: 25,
      width: 40,
      height: 20,
    });
  });

  it("stops at the left edge", () => {
    expect(moveSelection(original, { x: -500, y: 0 }, IMAGE_BOUNDS).x).toBe(0);
  });

  it("stops at the top edge", () => {
    expect(moveSelection(original, { x: 0, y: -500 }, IMAGE_BOUNDS).y).toBe(0);
  });

  it("stops at the right edge with the full width inside", () => {
    expect(moveSelection(original, { x: 500, y: 0 }, IMAGE_BOUNDS).x).toBe(160);
  });

  it("stops at the bottom edge with the full height inside", () => {
    expect(moveSelection(original, { x: 0, y: 500 }, IMAGE_BOUNDS).y).toBe(80);
  });

  it("never changes the size", () => {
    const moved = moveSelection(original, { x: -500, y: 500 }, IMAGE_BOUNDS);

    expect([moved.width, moved.height]).toEqual([40, 20]);
  });
});

describe("resizeSelection", () => {
  const original: Rect = { x: 50, y: 30, width: 40, height: 20 };

  it("drags the south-east corner", () => {
    expect(resizeSelection(original, "se", { x: 120, y: 70 }, IMAGE_BOUNDS)).toEqual({
      x: 50,
      y: 30,
      width: 70,
      height: 40,
    });
  });

  it("drags the north-west corner and keeps the opposite corner still", () => {
    expect(resizeSelection(original, "nw", { x: 40, y: 20 }, IMAGE_BOUNDS)).toEqual({
      x: 40,
      y: 20,
      width: 50,
      height: 30,
    });
  });

  it("drags the north-east corner", () => {
    expect(resizeSelection(original, "ne", { x: 100, y: 10 }, IMAGE_BOUNDS)).toEqual({
      x: 50,
      y: 10,
      width: 50,
      height: 40,
    });
  });

  it("drags the south-west corner", () => {
    expect(resizeSelection(original, "sw", { x: 30, y: 60 }, IMAGE_BOUNDS)).toEqual({
      x: 30,
      y: 30,
      width: 60,
      height: 30,
    });
  });

  it("keeps the 8 pixel minimum when the south-east corner is dragged past the origin", () => {
    expect(resizeSelection(original, "se", { x: 0, y: 0 }, IMAGE_BOUNDS)).toEqual({
      x: 50,
      y: 30,
      width: 8,
      height: 8,
    });
  });

  it("keeps the 8 pixel minimum when the north-west corner is dragged past the far corner", () => {
    expect(resizeSelection(original, "nw", { x: 500, y: 500 }, IMAGE_BOUNDS)).toEqual({
      x: 82,
      y: 42,
      width: 8,
      height: 8,
    });
  });

  it("keeps the 8 pixel minimum for the north-east corner", () => {
    expect(resizeSelection(original, "ne", { x: 0, y: 500 }, IMAGE_BOUNDS)).toEqual({
      x: 50,
      y: 42,
      width: 8,
      height: 8,
    });
  });

  it("keeps the 8 pixel minimum for the south-west corner", () => {
    expect(resizeSelection(original, "sw", { x: 500, y: 0 }, IMAGE_BOUNDS)).toEqual({
      x: 82,
      y: 30,
      width: 8,
      height: 8,
    });
  });

  it("clamps the south-east corner to the image", () => {
    expect(resizeSelection(original, "se", { x: 999, y: 999 }, IMAGE_BOUNDS)).toEqual({
      x: 50,
      y: 30,
      width: 150,
      height: 70,
    });
  });

  it("clamps the north-east corner to the right edge", () => {
    expect(resizeSelection(original, "ne", { x: 999, y: 10 }, IMAGE_BOUNDS)).toEqual({
      x: 50,
      y: 10,
      width: 150,
      height: 40,
    });
  });

  it("clamps the south-west corner to the bottom edge", () => {
    expect(resizeSelection(original, "sw", { x: 20, y: 999 }, IMAGE_BOUNDS)).toEqual({
      x: 20,
      y: 30,
      width: 70,
      height: 70,
    });
  });

  // The old app worked out the new size before clamping the position. A drag past the left or top
  // edge therefore leaves the size as if the pointer were outside, and the opposite edge moves.
  it("keeps the Python result when the north-west corner is dragged past the left edge", () => {
    expect(resizeSelection(original, "nw", { x: -50, y: 30 }, IMAGE_BOUNDS)).toEqual({
      x: 0,
      y: 30,
      width: 140,
      height: 20,
    });
  });

  it("keeps the Python result when the north-east corner is dragged past the top edge", () => {
    expect(resizeSelection(original, "ne", { x: 100, y: -50 }, IMAGE_BOUNDS)).toEqual({
      x: 50,
      y: 0,
      width: 50,
      height: 100,
    });
  });
});

describe("toFractions", () => {
  it("gives the selection as 0 to 1 of the displayed image", () => {
    const displayed: Rect = { x: 10, y: 20, width: 200, height: 100 };

    expect(toFractions({ x: 60, y: 45, width: 100, height: 25 }, displayed)).toEqual({
      x: 0.25,
      y: 0.25,
      width: 0.5,
      height: 0.25,
    });
  });
});

describe("toImagePixels", () => {
  const displayed: Rect = { x: 0, y: 0, width: 100, height: 100 };
  const image = { width: 5, height: 5 };

  it("scales the selection from the displayed image to the image's own pixels", () => {
    expect(
      toImagePixels(
        { x: 20, y: 40, width: 60, height: 20 },
        { x: 0, y: 0, width: 100, height: 50 },
        { width: 1000, height: 500 },
      ),
    ).toEqual({ x: 200, y: 400, width: 600, height: 200 });
  });

  it("subtracts the offset of the displayed image", () => {
    expect(
      toImagePixels(
        { x: 120, y: 60, width: 50, height: 50 },
        { x: 100, y: 50, width: 100, height: 100 },
        { width: 1000, height: 1000 },
      ),
    ).toEqual({ x: 200, y: 100, width: 500, height: 500 });
  });

  it("rounds an exact half to the even pixel, like Python round (2.5 gives 2)", () => {
    // 50 / 100 * 5 = 2.5: Python round gives 2, Math.round would give 3.
    expect(toImagePixels({ x: 50, y: 50, width: 50, height: 50 }, displayed, image)).toEqual({
      x: 2,
      y: 2,
      width: 2,
      height: 2,
    });
  });

  it("rounds a half of 0.5 down to 0 and 3.5 up to 4", () => {
    // 10 / 100 * 5 = 0.5 gives 0 (Math.round: 1); 70 / 100 * 5 = 3.5 gives 4.
    expect(toImagePixels({ x: 10, y: 70, width: 10, height: 70 }, displayed, image)).toEqual({
      x: 0,
      y: 4,
      width: 0,
      height: 4,
    });
  });
});
