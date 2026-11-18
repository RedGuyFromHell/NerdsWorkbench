import { describe, expect, it } from "vitest";
import { dragPosition, pointerToMm, roundToHundredths, wheelDirection, wheelEdit } from "./pointer";
import type { ImageLayer, TextLayer } from "./project";

const imageLayer: ImageLayer = {
  id: 1,
  type: "image",
  name: "logo",
  img: "i1",
  w: 40,
  x: 0,
  y: 0,
  rot: 10,
  opacity: 1,
  clip: "mask",
  flip: false,
  visible: true,
};

const textLayer: TextLayer = {
  id: 2,
  type: "text",
  name: "NERD CASTLE",
  text: "NERD CASTLE",
  font: "Cinzel",
  size: 6,
  spacing: 0.4,
  color: "#1a1a1a",
  stroke: "#ffffff",
  strokeW: 0,
  bold: true,
  italic: false,
  x: 0,
  y: 0,
  rot: 0,
  opacity: 1,
  clip: "disc",
  flip: false,
  visible: true,
};

describe("pointerToMm", () => {
  // 254 dpi is exactly 10 px per mm; a 100 mm disc with no bleed is a 1000 px canvas.
  const settings = { d: 100, bleed: 0, dpi: 254 };
  const rect = { left: 0, top: 0, width: 400, height: 400 };

  it("is 0, 0 at the middle of the canvas", () => {
    expect(pointerToMm([200, 200], rect, settings)).toEqual([0, 0]);
  });

  it("scales the shown size back to canvas pixels, then to mm", () => {
    // 300/400 of the way across is canvas pixel 750, 250 px right of the centre = 25 mm.
    expect(pointerToMm([300, 100], rect, settings)).toEqual([25, -25]);
  });

  it("takes the canvas position on the page off first", () => {
    const moved = { left: 100, top: 50, width: 400, height: 400 };
    expect(pointerToMm([400, 150], moved, settings)).toEqual([25, -25]);
  });
});

describe("dragPosition", () => {
  it("moves the layer by how far the pointer travelled since the grab", () => {
    const grab = { x: 5, y: -3, pointer: [10, 20] as const };
    expect(dragPosition(grab, [14, 17])).toEqual({ x: 9, y: -6 });
  });
});

describe("wheelDirection", () => {
  it("is up (1) when the wheel turns away from the user, down (-1) otherwise", () => {
    expect(wheelDirection(-100)).toBe(1);
    expect(wheelDirection(100)).toBe(-1);
  });
});

describe("roundToHundredths", () => {
  it("rounds to 2 decimals", () => {
    expect(roundToHundredths(1.236)).toBe(1.24);
    expect(roundToHundredths(-0.004)).toBe(-0);
  });
});

describe("wheelEdit", () => {
  it("turns the layer by 1 degree per step with the rotate key", () => {
    const turned = wheelEdit(imageLayer, { direction: 1, rotate: true, fine: false });
    expect(turned.rot).toBe(11);
  });

  it("turns by 0.1 degree per step with rotate and fine", () => {
    expect(wheelEdit(imageLayer, { direction: -1, rotate: true, fine: true }).rot).toBe(9.9);
  });

  it("grows an image width by 3% per step", () => {
    const grown = wheelEdit(imageLayer, { direction: 1, rotate: false, fine: false });
    expect(grown).toMatchObject({ w: expect.closeTo(41.2, 10) });
  });

  it("shrinks an image width by the inverse of 3% per step", () => {
    const shrunk = wheelEdit(imageLayer, { direction: -1, rotate: false, fine: false });
    expect(shrunk).toMatchObject({ w: expect.closeTo(38.835, 3) });
  });

  it("grows an image width by 0.5% per fine step", () => {
    const grown = wheelEdit(imageLayer, { direction: 1, rotate: false, fine: true });
    expect(grown).toMatchObject({ w: expect.closeTo(40.2, 10) });
  });

  it("changes a text layer's size, not its width", () => {
    const grown = wheelEdit(textLayer, { direction: 1, rotate: false, fine: false });
    expect(grown).toMatchObject({ size: expect.closeTo(6.18, 10) });
  });

  it("returns a new layer and leaves the old one alone", () => {
    wheelEdit(imageLayer, { direction: 1, rotate: true, fine: false });
    expect(imageLayer.rot).toBe(10);
  });
});
