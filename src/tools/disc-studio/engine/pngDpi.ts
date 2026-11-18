// Writes the print resolution into a PNG (a pHYs chunk) so print apps read the right size.
// Mirrors crc32 and pngWithDpi in disc-studio.html (lines 459-473); the parity test in tests/disc-parity is the final judge.

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const IHDR_TYPE = [0x49, 0x48, 0x44, 0x52]; // "IHDR"
const PHYS_TYPE = [0x70, 0x48, 0x59, 0x73]; // "pHYs"
const CHUNK_HEADER_BYTES = 8; // 4 length + 4 type
const IHDR_DATA_BYTES = 13;
// The pHYs chunk goes right after the signature and the IHDR chunk (length, type, data, crc).
const AFTER_IHDR_OFFSET = PNG_SIGNATURE.length + CHUNK_HEADER_BYTES + IHDR_DATA_BYTES + 4;
const PHYS_DATA_BYTES = 9;
const PHYS_CHUNK_BYTES = CHUNK_HEADER_BYTES + PHYS_DATA_BYTES + 4;
const PHYS_UNIT_METRE = 1;
const METRES_PER_INCH = 0.0254;
const CRC32_POLYNOMIAL = 0xedb88320;

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    let value = (crc ^ byte) & 0xff;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? (value >>> 1) ^ CRC32_POLYNOMIAL : value >>> 1;
    }
    crc = (crc >>> 8) ^ value;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function pixelsPerMetre(dpi: number): number {
  return Math.round(dpi / METRES_PER_INCH);
}

function startsWith(bytes: Uint8Array, offset: number, expected: readonly number[]): boolean {
  return expected.every((byte, index) => bytes[offset + index] === byte);
}

function physChunk(dpi: number): Uint8Array {
  const chunk = new Uint8Array(PHYS_CHUNK_BYTES);
  const view = new DataView(chunk.buffer);
  const ppm = pixelsPerMetre(dpi);
  view.setUint32(0, PHYS_DATA_BYTES);
  chunk.set(PHYS_TYPE, 4);
  view.setUint32(8, ppm);
  view.setUint32(12, ppm);
  chunk[16] = PHYS_UNIT_METRE;
  view.setUint32(17, crc32(chunk.subarray(4, 17)));
  return chunk;
}

/** Returns a copy of the PNG with a pHYs chunk after IHDR. Throws when the bytes are not a PNG. */
export function insertPhysChunk(png: Uint8Array, dpi: number): Uint8Array {
  const looksLikePng =
    png.length >= AFTER_IHDR_OFFSET &&
    startsWith(png, 0, PNG_SIGNATURE) &&
    startsWith(png, PNG_SIGNATURE.length + 4, IHDR_TYPE);
  if (!looksLikePng) throw new Error("These bytes are not a PNG image.");
  const out = new Uint8Array(png.length + PHYS_CHUNK_BYTES);
  out.set(png.subarray(0, AFTER_IHDR_OFFSET));
  out.set(physChunk(dpi), AFTER_IHDR_OFFSET);
  out.set(png.subarray(AFTER_IHDR_OFFSET), AFTER_IHDR_OFFSET + PHYS_CHUNK_BYTES);
  return out;
}
