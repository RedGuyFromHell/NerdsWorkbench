// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

// The renderer draws on real canvases; these tests are about the document's undo history only.
vi.mock("./render", () => ({
  DiscRenderer: class {
    buildMasks(): void {}
    draw(): void {}
  },
  fontString: () => "",
}));

import { DiscDocument } from "./document";
import type { TextLayer } from "./project";

const textLayer: TextLayer = {
  id: 1,
  type: "text",
  name: "NERD",
  text: "NERD",
  font: "Cinzel",
  size: 6,
  spacing: 0.4,
  color: "#1a1a1a",
  stroke: "#ffffff",
  strokeW: 0,
  bold: false,
  italic: false,
  x: 0,
  y: 0,
  rot: 0,
  opacity: 1,
  clip: "mask",
  flip: false,
  visible: true,
};

// A document holding one layer at x = 0, with that as its first undo-free state.
function documentWithLayer(): DiscDocument {
  const doc = new DiscDocument(document.createElement("canvas"));
  doc.layers = [textLayer];
  doc.markChanged();
  return doc;
}

const moveTo = (doc: DiscDocument, x: number): void => {
  doc.layers = doc.layers.map((layer) => ({ ...layer, x }));
  doc.markChanged();
};

describe("DiscDocument undo and redo during a gesture", () => {
  it("does nothing while a drag is open", () => {
    const doc = documentWithLayer();
    doc.beginGesture();
    moveTo(doc, 5);
    doc.undo();
    expect(doc.layers[0]?.x).toBe(5);
    doc.endGesture();
    doc.undo();
    expect(doc.layers[0]?.x).toBe(0);
  });

  it("does not redo while a drag is open", () => {
    const doc = documentWithLayer();
    moveTo(doc, 5);
    doc.undo();
    expect(doc.layers[0]?.x).toBe(0);
    doc.beginGesture();
    doc.redo();
    expect(doc.layers[0]?.x).toBe(0);
    doc.endGesture();
    doc.redo();
    expect(doc.layers[0]?.x).toBe(5);
  });
});

describe("DiscDocument.markSaved", () => {
  it("makes the next change after a save its own undo step", () => {
    const doc = documentWithLayer();
    moveTo(doc, 1); // a step, then saved right away: the same kind of change inside the merge window
    doc.markSaved(doc.committed);
    moveTo(doc, 2);
    doc.undo();
    expect(doc.layers[0]?.x).toBe(1);
    expect(doc.isDirty()).toBe(false);
  });
});
