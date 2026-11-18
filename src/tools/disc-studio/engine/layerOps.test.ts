import { describe, expect, it } from "vitest";
import {
  addStrokePoint,
  appendStroke,
  clearStrokes,
  coverWidth,
  duplicateLayer,
  fitImageLayer,
  fitWidth,
  moveLayer,
  nudgeLayer,
  replaceLastStroke,
  startStroke,
  undoStroke,
} from "./layerOps";
import type { ImageLayer, Layer, Stroke } from "./project";

const layerNamed = (id: number, name: string): ImageLayer => ({
  id,
  type: "image",
  name,
  img: "i1",
  w: 50,
  x: 0,
  y: 0,
  rot: 0,
  opacity: 1,
  clip: "mask",
  flip: false,
  visible: true,
});

const names = (layers: readonly Layer[]) => layers.map((layer) => layer.name);

describe("moveLayer", () => {
  const bottom = layerNamed(1, "bottom");
  const middle = layerNamed(2, "middle");
  const top = layerNamed(3, "top");
  const stack = [bottom, middle, top];

  it("moves a layer up one place (towards the end of the array)", () => {
    expect(names(moveLayer(stack, 2, 1))).toEqual(["bottom", "top", "middle"]);
  });

  it("moves a layer down one place", () => {
    expect(names(moveLayer(stack, 2, -1))).toEqual(["middle", "bottom", "top"]);
  });

  it("leaves the order alone when the top layer goes up", () => {
    expect(names(moveLayer(stack, 3, 1))).toEqual(["bottom", "middle", "top"]);
  });

  it("leaves the order alone when the bottom layer goes down", () => {
    expect(names(moveLayer(stack, 1, -1))).toEqual(["bottom", "middle", "top"]);
  });

  it("returns a new array and does not touch the input", () => {
    const moved = moveLayer(stack, 2, 1);
    expect(moved).not.toBe(stack);
    expect(names(stack)).toEqual(["bottom", "middle", "top"]);
    expect(moved[1]).toBe(top);
  });

  it("throws for a layer that is not in the list", () => {
    expect(() => moveLayer(stack, 99, 1)).toThrow("No layer with id 99");
  });
});

describe("duplicateLayer", () => {
  const stroke: Stroke = { mode: "erase", r: 0.05, soft: 0, pts: [[0.1, 0.2]] };
  const original: ImageLayer = { ...layerNamed(2, "logo"), x: 10, y: 5, erase: [stroke] };

  it("offsets the copy by 2 mm on both axes, names it 'copy' and gives it the new id", () => {
    const { copy } = duplicateLayer([original], 2, 9);
    expect(copy).toMatchObject({ id: 9, name: "logo copy", x: 12, y: 7, w: 50, img: "i1" });
  });

  it("puts the copy right above the original", () => {
    const first = layerNamed(1, "first");
    const last = layerNamed(3, "last");
    const { layers, copy } = duplicateLayer([first, original, last], 2, 9);
    expect(layers).toEqual([first, original, copy, last]);
  });

  it("copies the eraser strokes deeply", () => {
    const { copy } = duplicateLayer([original], 2, 9);
    expect(copy.erase).toEqual([stroke]);
    expect(copy.erase?.[0]).not.toBe(stroke);
    expect(copy.erase?.[0]?.pts).not.toBe(stroke.pts);
    expect(copy.erase?.[0]?.pts[0]).not.toBe(stroke.pts[0]);
  });

  it("gives a layer with no strokes an empty list", () => {
    const { copy } = duplicateLayer([layerNamed(1, "plain")], 1, 2);
    expect(copy.erase).toEqual([]);
  });

  it("does not change the original or the input list", () => {
    const input = [original];
    duplicateLayer(input, 2, 9);
    expect(input).toHaveLength(1);
    expect(original).toMatchObject({ x: 10, y: 5, name: "logo" });
  });

  it("throws for a layer that is not in the list", () => {
    expect(() => duplicateLayer([original], 99, 100)).toThrow("No layer with id 99");
  });
});

describe("cover and fit widths", () => {
  // aspect = natural width / natural height; the disc is 120 mm.
  it("wide image: cover is as wide as the disc times the ratio, fit is the disc", () => {
    expect(coverWidth(2, 120)).toBe(240);
    expect(fitWidth(2, 120)).toBe(120);
  });

  it("tall image: cover is the disc, fit is the disc times the ratio", () => {
    expect(coverWidth(0.5, 120)).toBe(120);
    expect(fitWidth(0.5, 120)).toBe(60);
  });

  it("square image: both are the disc", () => {
    expect(coverWidth(1, 120)).toBe(120);
    expect(fitWidth(1, 120)).toBe(120);
  });
});

describe("fitImageLayer", () => {
  const moved: ImageLayer = { ...layerNamed(1, "pic"), x: 7, y: -3, w: 10 };

  it("sets the width and centres the layer", () => {
    expect(fitImageLayer(moved, "cover", 2, 120)).toMatchObject({ w: 240, x: 0, y: 0 });
    expect(fitImageLayer(moved, "fit", 2, 120)).toMatchObject({ w: 120, x: 0, y: 0 });
    expect(fitImageLayer(moved, "fit", 0.5, 120)).toMatchObject({ w: 60 });
  });

  it("does not change the input", () => {
    fitImageLayer(moved, "cover", 2, 120);
    expect(moved).toMatchObject({ w: 10, x: 7, y: -3 });
  });
});

describe("stroke points", () => {
  it("starts a stroke: radius is half the brush as a share of the box width, point rounded to 4 places", () => {
    const stroke = startStroke({
      mode: "erase",
      brushMm: 5,
      soft: 0.5,
      boxWidth: 40,
      point: [0.12344, -0.12346],
    });
    expect(stroke).toEqual({ mode: "erase", r: 0.0625, soft: 0.5, pts: [[0.1234, -0.1235]] });
  });

  const base: Stroke = { mode: "restore", r: 2, soft: 0, pts: [[0, 0]] };

  it("adds a point that is more than 0.15 x radius from the last one", () => {
    const next = addStrokePoint(base, [0.31, 0]);
    expect(next.pts).toEqual([
      [0, 0],
      [0.31, 0],
    ]);
  });

  it("drops a point that is closer than that, returning the same stroke", () => {
    expect(addStrokePoint(base, [0.2, 0])).toBe(base);
  });

  it("drops a point at exactly 0.15 x radius (the test is 'more than')", () => {
    expect(addStrokePoint(base, [0.3, 0])).toBe(base);
  });

  it("measures from the last point, not the first", () => {
    const longer = addStrokePoint(base, [0.4, 0]);
    expect(addStrokePoint(longer, [0.5, 0])).toBe(longer);
    expect(addStrokePoint(longer, [0.71, 0]).pts).toHaveLength(3);
  });

  it("measures the distance on both axes", () => {
    expect(addStrokePoint(base, [0.25, 0.25]).pts).toHaveLength(2);
  });

  it("rounds the point it adds to 4 places", () => {
    expect(addStrokePoint(base, [0.40004, 0]).pts[1]).toEqual([0.4, 0]);
  });

  it("does not change the input stroke", () => {
    addStrokePoint(base, [0.31, 0]);
    expect(base.pts).toEqual([[0, 0]]);
  });
});

describe("strokes on a layer", () => {
  const first: Stroke = { mode: "erase", r: 0.1, soft: 0, pts: [[0, 0]] };
  const second: Stroke = { mode: "restore", r: 0.2, soft: 0.5, pts: [[1, 1]] };
  const plain = layerNamed(1, "plain");
  const erased: Layer = { ...plain, erase: [first, second] };

  it("appends a stroke to a layer that has none", () => {
    expect(appendStroke(plain, first).erase).toEqual([first]);
  });

  it("appends after the strokes already there, leaving the input alone", () => {
    expect(appendStroke({ ...plain, erase: [first] }, second).erase).toEqual([first, second]);
    expect(plain.erase).toBeUndefined();
  });

  it("replaces only the last stroke", () => {
    const longer: Stroke = {
      ...second,
      pts: [
        [1, 1],
        [2, 2],
      ],
    };
    expect(replaceLastStroke(erased, longer).erase).toEqual([first, longer]);
  });

  it("leaves a layer with no strokes as it is when replacing the last one", () => {
    expect(replaceLastStroke(plain, first)).toBe(plain);
  });

  it("undoes the last stroke", () => {
    expect(undoStroke(erased).erase).toEqual([first]);
  });

  it("has nothing to undo on a layer without strokes", () => {
    expect(undoStroke(plain)).toBe(plain);
    expect(undoStroke({ ...plain, erase: [] }).erase).toEqual([]);
  });

  it("clears every stroke", () => {
    expect(clearStrokes(erased).erase).toEqual([]);
  });
});

describe("nudgeLayer", () => {
  it("moves the layer by the step", () => {
    const moved = nudgeLayer({ ...layerNamed(1, "a"), x: 5, y: -2 }, 1, 0);
    expect([moved.x, moved.y]).toEqual([6, -2]);
  });

  it("rounds to hundredths, so repeated 0.1 steps do not drift", () => {
    let layer: Layer = { ...layerNamed(1, "a"), x: 0.2 };
    layer = nudgeLayer(layer, 0.1, 0);
    expect(layer.x).toBe(0.3);
    expect(nudgeLayer({ ...layer, y: 0.7 }, 0, 0.1).y).toBe(0.8);
  });
});
