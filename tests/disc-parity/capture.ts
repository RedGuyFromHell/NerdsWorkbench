// Turns a canvas into text the test can carry out of the page: its pixels, byte for byte.
export interface CanvasPixels {
  width: number;
  height: number;
  /** The RGBA bytes of `getImageData`, base64 encoded. */
  base64: string;
}

const CHUNK_BYTES = 0x8000;

export function requireCanvas(id: string): HTMLCanvasElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLCanvasElement)) throw new Error(`The page has no #${id} canvas.`);
  return element;
}

export function captureCanvas(canvas: HTMLCanvasElement): CanvasPixels {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No 2d canvas context.");
  const bytes = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let binary = "";
  for (let start = 0; start < bytes.length; start += CHUNK_BYTES) {
    binary += String.fromCharCode(...bytes.subarray(start, start + CHUNK_BYTES));
  }
  return { width: canvas.width, height: canvas.height, base64: btoa(binary) };
}

export interface Captured {
  print: CanvasPixels;
  view: CanvasPixels;
}

/** What each page offers the test: render a fixture by name and hand back both canvases. */
export interface ParityApi {
  render(fixtureName: string): Promise<Captured>;
}

declare global {
  interface Window {
    parity?: ParityApi;
  }
}
