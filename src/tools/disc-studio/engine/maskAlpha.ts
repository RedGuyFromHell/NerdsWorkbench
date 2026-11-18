// Turns an uploaded mask image into a black mask whose alpha is the ink.
// Mirrors buildMasks in disc-studio.html (lines 152-162); the parity test in tests/disc-parity is the final judge.

const ALPHA_TRANSPARENT_BELOW = 250; // any pixel below this makes the image "has alpha"
const LUMA_RED = 0.299;
const LUMA_GREEN = 0.587;
const LUMA_BLUE = 0.114;
const LUMINANCE_NO_INK = 200; // at or under this an opaque pixel gives no ink
const LUMINANCE_RAMP = 45; // 200 + 45 = 245 and above is full ink
const ALPHA_MAX = 255;

function hasTransparency(pixels: Uint8ClampedArray): boolean {
  for (let index = 3; index < pixels.length; index += 4) {
    if ((pixels[index] ?? ALPHA_MAX) < ALPHA_TRANSPARENT_BELOW) return true;
  }
  return false;
}

/**
 * RGBA pixels in, RGBA mask pixels out. An image with transparency keeps its alpha; an opaque
 * one gets its alpha from luminance (white is ink, dark or grey is none). The colour is always black.
 */
export function maskAlphaFromPixels(pixels: Uint8ClampedArray): Uint8ClampedArray {
  const opaque = !hasTransparency(pixels);
  const out = new Uint8ClampedArray(pixels.length);
  for (let index = 0; index < pixels.length; index += 4) {
    if (opaque) {
      const luminance =
        LUMA_RED * (pixels[index] ?? 0) +
        LUMA_GREEN * (pixels[index + 1] ?? 0) +
        LUMA_BLUE * (pixels[index + 2] ?? 0);
      out[index + 3] = Math.max(
        0,
        Math.min(ALPHA_MAX, ((luminance - LUMINANCE_NO_INK) * ALPHA_MAX) / LUMINANCE_RAMP),
      );
    } else {
      out[index + 3] = pixels[index + 3] ?? 0;
    }
  }
  return out;
}
