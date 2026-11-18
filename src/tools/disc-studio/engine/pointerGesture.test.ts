// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import type { DiscDocument } from "./document";
import { attachPointer } from "./pointer";
import type { ImageLayer } from "./project";

const CANVAS_PX = 1000; // a 100 mm disc with no bleed at 254 dpi is 10 px per mm
const CENTRE_PX = CANVAS_PX / 2;

const logo: ImageLayer = {
  id: 1,
  type: "image",
  name: "logo",
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

// Only what attachPointer touches; the real document needs a drawing canvas.
function fakeDocument() {
  const state = { gestureOpen: false };
  const doc = {
    tool: "move",
    layers: [logo],
    selected: null as ImageLayer | null,
    hover: null,
    settings: { d: 100, bleed: 0, dpi: 254 },
    renderer: { boxOf: () => ({ width: 40, height: 40 }) },
    beginGesture: vi.fn(() => {
      state.gestureOpen = true;
    }),
    endGesture: vi.fn(() => {
      state.gestureOpen = false;
    }),
    markChanged: vi.fn(),
    requestDraw: vi.fn(),
    subscribe: () => () => undefined,
  };
  return { doc, state, discDocument: doc as unknown as DiscDocument };
}

function fakeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: CANVAS_PX, height: CANVAS_PX }) as DOMRect;
  canvas.setPointerCapture = vi.fn();
  return canvas;
}

const pointerAt = (type: string, px: number): PointerEvent =>
  new PointerEvent(type, { clientX: px, clientY: CENTRE_PX, pointerId: 1 });

describe("attachPointer gestures", () => {
  it("ends the drag when the pointer is released", () => {
    const canvas = fakeCanvas();
    const { doc, state, discDocument } = fakeDocument();
    attachPointer(canvas, discDocument);
    canvas.dispatchEvent(pointerAt("pointerdown", CENTRE_PX));
    expect(state.gestureOpen).toBe(true);
    canvas.dispatchEvent(pointerAt("pointerup", CENTRE_PX));
    expect(state.gestureOpen).toBe(false);
    expect(doc.endGesture).toHaveBeenCalledTimes(1);
  });

  it("ends the drag when the capture is lost without a pointerup", () => {
    const canvas = fakeCanvas();
    const { state, discDocument } = fakeDocument();
    attachPointer(canvas, discDocument);
    canvas.dispatchEvent(pointerAt("pointerdown", CENTRE_PX));
    expect(state.gestureOpen).toBe(true);
    canvas.dispatchEvent(new Event("lostpointercapture"));
    expect(state.gestureOpen).toBe(false);
  });

  it("stops moving the layer once the capture is lost", () => {
    const canvas = fakeCanvas();
    const { doc, discDocument } = fakeDocument();
    attachPointer(canvas, discDocument);
    canvas.dispatchEvent(pointerAt("pointerdown", CENTRE_PX));
    canvas.dispatchEvent(pointerAt("pointermove", CENTRE_PX + 100)); // 10 mm right
    expect(doc.layers[0]?.x).toBe(10);
    canvas.dispatchEvent(new Event("lostpointercapture"));
    canvas.dispatchEvent(pointerAt("pointermove", CENTRE_PX + 200));
    expect(doc.layers[0]?.x).toBe(10);
  });

  it("takes the capture listener off with the others", () => {
    const canvas = fakeCanvas();
    const { state, discDocument } = fakeDocument();
    const detach = attachPointer(canvas, discDocument);
    canvas.dispatchEvent(pointerAt("pointerdown", CENTRE_PX));
    detach();
    canvas.dispatchEvent(new Event("lostpointercapture"));
    expect(state.gestureOpen).toBe(true);
  });
});
