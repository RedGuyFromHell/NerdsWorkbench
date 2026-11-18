import { describe, expect, it } from "vitest";
import {
  bandArcPath,
  builtinMaskRadii,
  canvasSize,
  cutRadii,
  guideRadii,
  hitTest,
  layerBox,
  pxPerMm,
  safeMarginMm,
  toLocal,
  type BoxSource,
} from "./geometry";
import type { DiscSettings, ImageLayer, Layer, TextLayer } from "./project";
import { DEFAULT_SETTINGS } from "./project";

// At 25.4 dpi one mm is exactly one pixel, so the expected values below are worked by hand in mm.
const UNIT: DiscSettings = {
  ...DEFAULT_SETTINGS,
  dpi: 25.4,
  d: 100,
  hole: 10,
  bleed: 2,
  margin: 4,
  band: 20,
  curve: 10,
  maskMode: "builtin",
};

describe("pxPerMm and canvasSize", () => {
  it("is 300 / 25.4 px per mm at 300 dpi", () => {
    expect(pxPerMm(300)).toBeCloseTo(11.811023622, 9);
  });

  it("is 1 at 25.4 dpi", () => {
    expect(pxPerMm(25.4)).toBe(1);
  });

  it("sizes the canvas as the disc plus bleed on both sides, rounded", () => {
    expect(canvasSize({ ...DEFAULT_SETTINGS, d: 120, bleed: 1, dpi: 300 })).toBe(1441);
    expect(canvasSize(UNIT)).toBe(104);
  });
});

describe("cutRadii", () => {
  it("is the disc grown by the bleed and the hole shrunk by it", () => {
    expect(cutRadii(UNIT)).toEqual({ outer: 52, inner: 3 });
  });

  it("never goes below zero for a small hole", () => {
    expect(cutRadii({ ...UNIT, hole: 2 }).inner).toBe(0);
  });
});

describe("builtinMaskRadii", () => {
  it("with a margin pulls both edges in by it", () => {
    expect(builtinMaskRadii({ ...UNIT, margin: 4 })).toEqual({ outer: 46, inner: 9 });
  });

  it("without a margin follows the cut shape", () => {
    expect(builtinMaskRadii({ ...UNIT, margin: 0 })).toEqual({ outer: 52, inner: 3 });
  });

  it("has no hole ring when the hole is 0", () => {
    expect(builtinMaskRadii({ ...UNIT, hole: 0 }).inner).toBe(0);
    expect(builtinMaskRadii({ ...UNIT, hole: 0, margin: 0 }).inner).toBe(0);
  });

  it("never goes below zero without a margin", () => {
    expect(builtinMaskRadii({ ...UNIT, hole: 2, bleed: 2, margin: 0 }).inner).toBe(0);
  });

  it("scales with dpi", () => {
    const radii = builtinMaskRadii({ ...UNIT, dpi: 300, margin: 4 });
    expect(radii.outer).toBeCloseTo(46 * 11.811023622, 6);
    expect(radii.inner).toBeCloseTo(9 * 11.811023622, 6);
  });
});

describe("bandArcPath", () => {
  it("draws the curved band as an arc to the corner, as the HTML writes it", () => {
    // 100 px canvas, centre 50. Peak at 50 + (50 - 20) = 80, bow 10, so top 90.
    // Arc radius = (100 * 100 / 4 + 10 * 10) / (2 * 10) = 130.
    expect(bandArcPath({ ...UNIT, bleed: 0 })).toBe(
      "M 0 90 A 130 130 0 0 1 100 90 L 100 100 L 0 100 Z",
    );
  });

  it("is a straight line when the curve is 0", () => {
    expect(bandArcPath({ ...UNIT, bleed: 0, curve: 0 })).toBe(
      "M 0 80 L 100 80 L 100 100 L 0 100 Z",
    );
  });

  it("is a straight line, lower than the peak, for a negative curve", () => {
    expect(bandArcPath({ ...UNIT, bleed: 0, curve: -5 })).toBe(
      "M 0 75 L 100 75 L 100 100 L 0 100 Z",
    );
  });

  it("is null when there is no band", () => {
    expect(bandArcPath({ ...UNIT, band: 0 })).toBeNull();
  });
});

describe("safeMarginMm and guideRadii", () => {
  it("is the margin plus 2 for the built-in mask with a margin", () => {
    expect(safeMarginMm({ ...UNIT, margin: 4 })).toBe(6);
  });

  it("is 4 without a margin, or with another mask type", () => {
    expect(safeMarginMm({ ...UNIT, margin: 0 })).toBe(4);
    expect(safeMarginMm({ ...UNIT, maskMode: "upload" })).toBe(4);
    expect(safeMarginMm({ ...UNIT, maskMode: "none" })).toBe(4);
  });

  it("gives the four guide circles in pixels", () => {
    expect(guideRadii(UNIT)).toEqual({ cut: 50, safe: 44, hole: 5, holeSafe: 11 });
  });
});

const TEXT_BASE: TextLayer = {
  id: 1,
  type: "text",
  name: "t",
  text: "AB",
  font: "Cinzel",
  size: 5,
  spacing: 0,
  color: "#000000",
  stroke: "#ffffff",
  strokeW: 0,
  bold: false,
  italic: false,
  x: 0,
  y: 0,
  rot: 0,
  opacity: 1,
  clip: "disc",
  flip: false,
  visible: true,
};

const IMAGE_BASE: ImageLayer = {
  id: 2,
  type: "image",
  name: "i",
  img: "i1",
  w: 40,
  x: 0,
  y: 0,
  rot: 0,
  opacity: 1,
  clip: "mask",
  flip: false,
  visible: true,
};

const source: BoxSource = {
  imageNaturalSize: (imageId) =>
    imageId === "i1" ? { width: 200, height: 100 } : { width: 100, height: 200 },
  measureLine: (_layer, line) => line.length * 70, // pixels at font size 10
};

describe("layerBox", () => {
  it("keeps the image width and scales the height by the image ratio", () => {
    expect(layerBox(IMAGE_BASE, source)).toEqual({ width: 40, height: 20 });
  });

  it("computes the image height as w * nh / nw, the order the HTML uses, to the last bit", () => {
    // WHY: 10 * (1 / 3) is 3.333333333333333 but 10 * 1 / 3 is 3.3333333333333335.
    const thirds: BoxSource = { ...source, imageNaturalSize: () => ({ width: 3, height: 1 }) };
    expect(layerBox({ ...IMAGE_BASE, w: 10 }, thirds).height).toBe(3.3333333333333335);
  });

  it("measures the widest text line at font size 10, divides by 10 and adds 0.01", () => {
    const box = layerBox({ ...TEXT_BASE, text: "AB\nABCD" }, source);
    expect(box.width).toBeCloseTo(28.01, 10);
  });

  it("is lines x size x 1.15 high", () => {
    const box = layerBox({ ...TEXT_BASE, text: "A\nB\nC", size: 5 }, source);
    expect(box.height).toBeCloseTo(17.25, 10);
  });
});

describe("toLocal", () => {
  it("with no turn is the offset from the layer, as a share of the box width", () => {
    const layer = { x: 10, y: 20, rot: 0, flip: false };
    const [lx, ly] = toLocal(layer, [15, 40], 20);
    expect(lx).toBeCloseTo(0.25, 12);
    expect(ly).toBeCloseTo(1, 12);
  });

  it("undoes a rotation of 30 degrees", () => {
    // offset (10, 0) turned by -30 degrees: (10 cos30, -10 sin30) = (8.660254, -5); width 20
    const [lx, ly] = toLocal({ x: 0, y: 0, rot: 30, flip: false }, [10, 0], 20);
    expect(lx).toBeCloseTo(0.4330127, 7);
    expect(ly).toBeCloseTo(-0.25, 7);
  });

  it("with rotation 90 and mirror: offset (0, 10) becomes (10, 0), then x is negated", () => {
    const [lx, ly] = toLocal({ x: 10, y: 20, rot: 90, flip: true }, [10, 30], 40);
    expect(lx).toBeCloseTo(-0.25, 10);
    expect(ly).toBeCloseTo(0, 10);
  });
});

describe("hitTest", () => {
  const wideBox = () => ({ width: 40, height: 10 });

  it("hits a point inside an unrotated box and misses outside it", () => {
    const layer: Layer = { ...IMAGE_BASE, id: 1 };
    expect(hitTest([layer], [19, 4], wideBox)).toBe(layer);
    expect(hitTest([layer], [21, 0], wideBox)).toBeNull();
    expect(hitTest([layer], [0, 6], wideBox)).toBeNull();
  });

  it("follows the rotation: a box turned 90 degrees is tall", () => {
    const layer: Layer = { ...IMAGE_BASE, id: 1, rot: 90 };
    expect(hitTest([layer], [0, 15], wideBox)).toBe(layer);
    expect(hitTest([layer], [15, 0], wideBox)).toBeNull();
  });

  it("follows the layer position", () => {
    const layer: Layer = { ...IMAGE_BASE, id: 1, x: 50, y: 50 };
    expect(hitTest([layer], [50, 50], wideBox)).toBe(layer);
    expect(hitTest([layer], [0, 0], wideBox)).toBeNull();
  });

  it("picks the topmost layer, which is the last", () => {
    const lower: Layer = { ...IMAGE_BASE, id: 1 };
    const upper: Layer = { ...IMAGE_BASE, id: 2 };
    expect(hitTest([lower, upper], [0, 0], wideBox)).toBe(upper);
  });

  it("skips hidden layers", () => {
    const lower: Layer = { ...IMAGE_BASE, id: 1 };
    const hidden: Layer = { ...IMAGE_BASE, id: 2, visible: false };
    expect(hitTest([lower, hidden], [0, 0], wideBox)).toBe(lower);
  });

  it("is null for no layers", () => {
    expect(hitTest([], [0, 0], wideBox)).toBeNull();
  });
});
