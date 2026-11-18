import { describe, expect, it } from "vitest";
import { maskAlphaFromPixels } from "./maskAlpha";

const pixels = (...rgba: number[]) => Uint8ClampedArray.from(rgba);

describe("maskAlphaFromPixels", () => {
  it("keeps the alpha of an image that has any transparency", () => {
    const out = maskAlphaFromPixels(pixels(10, 20, 30, 0, 200, 200, 200, 100, 255, 255, 255, 255));
    expect(Array.from(out)).toEqual([0, 0, 0, 0, 0, 0, 0, 100, 0, 0, 0, 255]);
  });

  it("treats alpha 249 as transparency and alpha 250 as opaque", () => {
    // 249 in the first pixel: alpha kept. Whole image at 250: opaque, so luminance decides.
    expect(Array.from(maskAlphaFromPixels(pixels(255, 255, 255, 249)))).toEqual([0, 0, 0, 249]);
    expect(Array.from(maskAlphaFromPixels(pixels(255, 255, 255, 250)))).toEqual([0, 0, 0, 255]);
  });

  it("maps luminance 200 to alpha 0 and 245 to alpha 255 on an opaque image", () => {
    const out = maskAlphaFromPixels(pixels(200, 200, 200, 255, 245, 245, 245, 255));
    expect(out[3]).toBe(0);
    expect(out[7]).toBe(255);
  });

  it("ramps linearly between 200 and 245 (grey 223 is 23 / 45 of 255)", () => {
    const out = maskAlphaFromPixels(pixels(223, 223, 223, 255));
    expect(out[3]).toBe(130);
  });

  it("clamps: black gives 0 and white gives 255", () => {
    const out = maskAlphaFromPixels(pixels(0, 0, 0, 255, 255, 255, 255, 255));
    expect(out[3]).toBe(0);
    expect(out[7]).toBe(255);
  });

  it("weighs red 0.299, green 0.587 and blue 0.114", () => {
    // yellow: luminance 225.93, (25.93 * 255 / 45) = 146.9; with blue 100: 237.33 gives 211.6
    const out = maskAlphaFromPixels(pixels(255, 255, 0, 255, 255, 255, 100, 255));
    expect(out[3]).toBe(147);
    expect(out[7]).toBe(212);
  });

  it("always sets red, green and blue to 0", () => {
    const opaque = maskAlphaFromPixels(pixels(9, 99, 199, 255));
    const clear = maskAlphaFromPixels(pixels(9, 99, 199, 40));
    expect(Array.from(opaque.subarray(0, 3))).toEqual([0, 0, 0]);
    expect(Array.from(clear.subarray(0, 3))).toEqual([0, 0, 0]);
  });

  it("does not change its input", () => {
    const input = pixels(223, 223, 223, 255);
    maskAlphaFromPixels(input);
    expect(Array.from(input)).toEqual([223, 223, 223, 255]);
  });

  it("gives an empty array for no pixels", () => {
    expect(maskAlphaFromPixels(new Uint8ClampedArray(0)).length).toBe(0);
  });
});
