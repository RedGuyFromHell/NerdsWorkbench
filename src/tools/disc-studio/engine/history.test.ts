// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  beginGesture,
  changeKey,
  endGesture,
  isDirty,
  MAX_HISTORY_STEPS,
  MERGE_WINDOW_MS,
  recordChange,
  redo,
  resetHistory,
  sameContent,
  sealHistory,
  undo,
  type DiscContent,
  type History,
} from "./history";
import { DEFAULT_SETTINGS, type Layer, type TextLayer } from "./project";
import type { LoadedImage } from "./document";

const textLayer = (id: number, overrides: Partial<TextLayer> = {}): TextLayer => ({
  id,
  type: "text",
  name: `layer ${id}`,
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
  ...overrides,
});

const loadedImage = (src: string): LoadedImage => ({ img: new Image(), src });

const withLayers = (layers: Layer[]): DiscContent => ({
  settings: { ...DEFAULT_SETTINGS },
  layers,
  images: new Map(),
  mask: null,
  nextId: 1,
  selectedId: null,
});

// The same content with one layer moved sideways by `dx`.
const moved = (content: DiscContent, layerId: number, dx: number): DiscContent => ({
  ...content,
  layers: content.layers.map((layer) =>
    layer.id === layerId ? { ...layer, x: layer.x + dx } : layer,
  ),
});

const withSetting = (content: DiscContent, diameter: number): DiscContent => ({
  ...content,
  settings: { ...content.settings, d: diameter },
});

describe("sameContent", () => {
  const base = withLayers([textLayer(1), textLayer(2)]);

  it("is true for the same references", () => {
    expect(sameContent(base, { ...base })).toBe(true);
  });

  it("is true for a new settings object with the same fields", () => {
    expect(sameContent(base, { ...base, settings: { ...base.settings } })).toBe(true);
  });

  it("is false when one setting differs", () => {
    expect(sameContent(base, withSetting(base, 100))).toBe(false);
  });

  it("is false when one layer is replaced, one is added or the order changes", () => {
    expect(sameContent(base, moved(base, 2, 1))).toBe(false);
    expect(sameContent(base, { ...base, layers: [...base.layers, textLayer(3)] })).toBe(false);
    expect(sameContent(base, { ...base, layers: [...base.layers].reverse() })).toBe(false);
  });

  it("is false when the mask is swapped", () => {
    expect(sameContent(base, { ...base, mask: loadedImage("data:mask") })).toBe(false);
  });

  it("is false when an image key is added", () => {
    const withImage = { ...base, images: new Map([["i1", loadedImage("data:one")]]) };
    expect(sameContent(base, withImage)).toBe(false);
  });

  it("ignores the selected id", () => {
    expect(sameContent(base, { ...base, selectedId: 2 })).toBe(true);
  });
});

describe("changeKey", () => {
  const first = textLayer(1);
  const second = textLayer(2);
  const base = withLayers([first, second]);

  it("names the one setting that changed", () => {
    const after = { ...base, settings: { ...base.settings, margin: 9 } };
    expect(changeKey(base, after)).toBe("settings:margin");
  });

  it("names the layer and the one field that changed", () => {
    expect(changeKey(base, moved(base, 2, 1))).toBe("layer:2:x");
  });

  it("sorts the fields when a layer has two changed", () => {
    const after = withLayers([first, { ...second, y: 3, x: 3 }]);
    expect(changeKey(base, after)).toBe("layer:2:x,y");
  });

  it("is null for an add, a delete and a reorder", () => {
    expect(changeKey(base, { ...base, layers: [...base.layers, textLayer(3)] })).toBeNull();
    expect(changeKey(base, withLayers([first]))).toBeNull();
    expect(changeKey(base, withLayers([second, first]))).toBeNull();
  });

  it("is null when two layers changed", () => {
    expect(changeKey(base, moved(moved(base, 1, 1), 2, 1))).toBeNull();
  });

  it("is null when a setting and a layer changed together", () => {
    expect(changeKey(base, withSetting(moved(base, 1, 1), 99))).toBeNull();
  });

  it("is null for a mask upload", () => {
    expect(changeKey(base, { ...base, mask: loadedImage("data:mask") })).toBeNull();
  });
});

describe("recordChange", () => {
  const start = withLayers([textLayer(1)]);

  it("adds a step for a content change", () => {
    const history = recordChange(resetHistory(start), moved(start, 1, 5), 0);
    expect(history.past).toHaveLength(1);
    expect(undo(history)?.content).toEqual(start);
  });

  it("adds no step for a selection-only change, but remembers the selection", () => {
    const selected = { ...start, selectedId: 1 };
    const history = recordChange(resetHistory(start), selected, 0);
    expect(history.past).toHaveLength(0);
    const changed = recordChange(history, moved(selected, 1, 5), 10);
    expect(undo(changed)?.content.selectedId).toBe(1);
  });

  it("clears the redo steps", () => {
    const changed = recordChange(resetHistory(start), moved(start, 1, 5), 0);
    const undone = undo(changed);
    expect(undone && redo(undone.history)).not.toBeNull();
    const again = recordChange(undone?.history ?? changed, moved(start, 1, 9), 5000);
    expect(redo(again)).toBeNull();
  });

  it("merges the same kind of change inside the window", () => {
    let history = recordChange(resetHistory(start), moved(start, 1, 1), 0);
    history = recordChange(history, moved(start, 1, 2), 400);
    history = recordChange(history, moved(start, 1, 3), 400 + MERGE_WINDOW_MS);
    expect(history.past).toHaveLength(1);
    expect(undo(history)?.content).toEqual(start);
  });

  it("starts a new step after the window", () => {
    let history = recordChange(resetHistory(start), moved(start, 1, 1), 0);
    history = recordChange(history, moved(start, 1, 2), MERGE_WINDOW_MS + 1);
    expect(history.past).toHaveLength(2);
  });

  it("does not merge a different kind of change", () => {
    let history = recordChange(resetHistory(start), moved(start, 1, 1), 0);
    history = recordChange(history, withSetting(moved(start, 1, 1), 99), 10);
    expect(history.past).toHaveLength(2);
  });

  it("never merges a change with no key", () => {
    let history = recordChange(resetHistory(start), withLayers([textLayer(1), textLayer(2)]), 0);
    history = recordChange(history, withLayers([textLayer(1), textLayer(2), textLayer(3)]), 10);
    expect(history.past).toHaveLength(2);
  });

  it("makes every change in a gesture one step", () => {
    let history = beginGesture(resetHistory(start));
    history = recordChange(history, { ...start, selectedId: 1 }, 0);
    history = recordChange(history, moved(start, 1, 1), 10);
    history = recordChange(history, withSetting(moved(start, 1, 1), 99), 20);
    history = recordChange(history, moved(start, 1, 3), 5000);
    expect(history.past).toHaveLength(1);
    expect(undo(history)?.content.settings.d).toBe(start.settings.d);
  });

  it("makes no step for a gesture with no change", () => {
    const history = endGesture(beginGesture(resetHistory(start)));
    expect(history.past).toHaveLength(0);
  });

  it("starts a new step after a gesture ends, even with the same key inside the window", () => {
    let history = beginGesture(resetHistory(start));
    history = recordChange(history, moved(start, 1, 1), 0);
    history = endGesture(history);
    history = recordChange(history, moved(start, 1, 2), 10);
    expect(history.past).toHaveLength(2);
  });

  it("starts a gesture with a new step even when the step before has the same key", () => {
    let history = recordChange(resetHistory(start), moved(start, 1, 1), 0);
    history = beginGesture(history);
    history = recordChange(history, moved(start, 1, 2), 10);
    expect(history.past).toHaveLength(2);
  });

  it("drops the oldest step past the cap", () => {
    let history = resetHistory(start);
    for (let step = 1; step <= MAX_HISTORY_STEPS + 5; step++) {
      history = recordChange(history, withLayers([textLayer(step + 1)]), step);
    }
    expect(history.past).toHaveLength(MAX_HISTORY_STEPS);
    expect(history.past[0]?.layers[0]?.id).toBe(6);
  });

  it("keeps one image map while the keys stay the same", () => {
    const first = recordChange(
      resetHistory(start),
      { ...start, images: new Map([["i1", loadedImage("data:one")]]) },
      0,
    );
    const next = { ...moved(start, 1, 3), images: new Map([["i1", loadedImage("data:one")]]) };
    const second = recordChange(first, next, 5000);
    expect(second.present.images).toBe(first.present.images);
  });

  it("is not changed by the live image map being edited afterwards", () => {
    const live = new Map([["i1", loadedImage("data:one")]]);
    const history = recordChange(resetHistory(start), { ...start, images: live }, 0);
    live.set("i2", loadedImage("data:two"));
    expect([...history.present.images.keys()]).toEqual(["i1"]);
  });
});

describe("undo and redo", () => {
  const start = withLayers([textLayer(1)]);
  const first = moved(start, 1, 10);
  const second = withSetting(moved(start, 1, 20), 99);

  const twoSteps = (): History =>
    recordChange(recordChange(resetHistory(start), first, 0), second, 10);

  it("returns the content to restore, walking back and forth", () => {
    const back = undo(twoSteps());
    expect(back?.content).toEqual(first);
    const backAgain = back && undo(back.history);
    expect(backAgain?.content).toEqual(start);
    const forward = backAgain && redo(backAgain.history);
    expect(forward?.content).toEqual(first);
    const forwardAgain = forward && redo(forward.history);
    expect(forwardAgain?.content).toEqual(second);
  });

  it("returns null at both ends", () => {
    expect(undo(resetHistory(start))).toBeNull();
    expect(redo(resetHistory(start))).toBeNull();
    expect(redo(twoSteps())).toBeNull();
  });

  it("clears redo when a change follows an undo", () => {
    const back = undo(twoSteps());
    const changed = recordChange(back?.history ?? twoSteps(), moved(first, 1, 7), 9000);
    expect(redo(changed)).toBeNull();
    expect(undo(changed)?.content).toEqual(first);
  });

  it("seals the step on redo: a same-key change right after is a new step", () => {
    const merged = recordChange(
      recordChange(resetHistory(start), moved(start, 1, 1), 0),
      moved(start, 1, 2),
      10,
    );
    const back = undo(merged);
    const forward = back && redo(back.history);
    const after = recordChange(forward?.history ?? merged, moved(start, 1, 3), 20);
    expect(after.past).toHaveLength(2);
  });

  it("seals the step on undo: a same-key change right after is a new step", () => {
    const nudged = moved(start, 1, 1);
    let history = recordChange(resetHistory(start), nudged, 0);
    history = recordChange(history, withSetting(nudged, 5), 10);
    const back = undo(history);
    const after = recordChange(back?.history ?? history, withSetting(nudged, 6), 20);
    expect(after.past).toHaveLength(2);
  });
});

describe("resetHistory", () => {
  it("starts with nothing to undo or redo", () => {
    const history = resetHistory(withLayers([textLayer(1)]));
    expect(undo(history)).toBeNull();
    expect(redo(history)).toBeNull();
  });
});

describe("isDirty", () => {
  const saved = withLayers([textLayer(1)]);

  it("is clean for the content that was saved", () => {
    expect(isDirty(resetHistory(saved), saved)).toBe(false);
  });

  it("is dirty after a content change", () => {
    const changed = recordChange(resetHistory(saved), moved(saved, 1, 2), 0);
    expect(isDirty(changed, saved)).toBe(true);
  });

  it("is clean again when an undo walks back to the saved content", () => {
    const changed = recordChange(resetHistory(saved), moved(saved, 1, 2), 0);
    const walked = undo(changed);
    expect(walked && isDirty(walked.history, saved)).toBe(false);
  });

  it("is dirty again after a redo, and ignores a selection alone", () => {
    const changed = recordChange(resetHistory(saved), moved(saved, 1, 2), 0);
    const walked = undo(changed);
    const again = walked && redo(walked.history);
    expect(again && isDirty(again.history, saved)).toBe(true);
    expect(isDirty(recordChange(resetHistory(saved), { ...saved, selectedId: 1 }, 0), saved)).toBe(
      false,
    );
  });
});

describe("sealHistory", () => {
  const start = withLayers([textLayer(1)]);

  it("makes the next change of the same kind a new step, even inside the merge window", () => {
    let history = recordChange(resetHistory(start), moved(start, 1, 1), 0);
    history = sealHistory(history);
    history = recordChange(history, moved(start, 1, 2), 10);
    expect(history.past).toHaveLength(2);
  });

  it("without it the same two changes merge", () => {
    let history = recordChange(resetHistory(start), moved(start, 1, 1), 0);
    history = recordChange(history, moved(start, 1, 2), 10);
    expect(history.past).toHaveLength(1);
  });

  it("changes nothing else", () => {
    const history = recordChange(resetHistory(start), moved(start, 1, 1), 0);
    expect(sealHistory(history)).toEqual({ ...history, sealed: true });
  });
});
