import { describe, expect, it } from "vitest";
import { crc32, insertPhysChunk, pixelsPerMetre } from "./pngDpi";

// A real 1 x 1 RGBA PNG: signature (8), IHDR chunk (25), then IDAT and IEND.
const TINY_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

const bytesOf = (text: string) => new TextEncoder().encode(text);

describe("crc32", () => {
  it("gives 0xAE426082 for the PNG end marker IEND", () => {
    expect(crc32(bytesOf("IEND"))).toBe(0xae426082);
  });

  it("gives the standard check value 0xCBF43926 for 123456789", () => {
    expect(crc32(bytesOf("123456789"))).toBe(0xcbf43926);
  });

  it("gives 0 for no bytes", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe("pixelsPerMetre", () => {
  it("rounds dpi / 0.0254", () => {
    expect(pixelsPerMetre(300)).toBe(11811);
    expect(pixelsPerMetre(72)).toBe(2835);
  });
});

describe("insertPhysChunk", () => {
  it("puts a 21-byte pHYs chunk right after IHDR, at 300 dpi", () => {
    const out = insertPhysChunk(TINY_PNG, 300);
    expect(out.length).toBe(TINY_PNG.length + 21);
    expect(out.subarray(0, 33)).toEqual(TINY_PNG.subarray(0, 33));
    // length 9, "pHYs", 11811 ppm twice, unit 1 (metre), crc
    const expected = [
      0x00, 0x00, 0x00, 0x09, 0x70, 0x48, 0x59, 0x73, 0x00, 0x00, 0x2e, 0x23, 0x00, 0x00, 0x2e,
      0x23, 0x01, 0x78, 0xa5, 0x3f, 0x76,
    ];
    expect(Array.from(out.subarray(33, 54))).toEqual(expected);
    expect(out.subarray(54)).toEqual(TINY_PNG.subarray(33));
  });

  it("writes 2835 ppm at 72 dpi", () => {
    const out = insertPhysChunk(TINY_PNG, 72);
    const expected = [
      0x00, 0x00, 0x00, 0x09, 0x70, 0x48, 0x59, 0x73, 0x00, 0x00, 0x0b, 0x13, 0x00, 0x00, 0x0b,
      0x13, 0x01, 0x00, 0x9a, 0x9c, 0x18,
    ];
    expect(Array.from(out.subarray(33, 54))).toEqual(expected);
  });

  it("does not change the input", () => {
    const copy = TINY_PNG.slice();
    insertPhysChunk(TINY_PNG, 300);
    expect(TINY_PNG).toEqual(copy);
  });

  it("throws on bytes that are not a PNG", () => {
    expect(() =>
      insertPhysChunk(bytesOf("not a png at all, just text, long enough....."), 300),
    ).toThrow("not a PNG");
    expect(() => insertPhysChunk(new Uint8Array(10), 300)).toThrow("not a PNG");
  });

  it("throws when IHDR is not the first chunk", () => {
    const broken = TINY_PNG.slice();
    broken[12] = 0x58; // "IHDR" becomes "XHDR"
    expect(() => insertPhysChunk(broken, 300)).toThrow("not a PNG");
  });
});
