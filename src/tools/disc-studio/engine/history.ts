// The undo history of a Disc Studio document, as a pure value. A step is a snapshot of the content
// (settings, layers, images, mask, next id, selection), not a command: the engine replaces values and
// never edits them in place, so a snapshot holds references and costs almost nothing.
// DiscDocument keeps one History and swaps it on every change; nothing here touches a canvas.
import type { LoadedImage } from "./document";
import type { DiscSettings, Layer } from "./project";

export const MAX_HISTORY_STEPS = 100;
export const MERGE_WINDOW_MS = 1000; // changes of one kind closer together than this are one step

/** What undo restores. View state (tool, brush, hover) is not content. */
export interface DiscContent {
  settings: DiscSettings;
  layers: Layer[];
  images: ReadonlyMap<string, LoadedImage>;
  mask: LoadedImage | null;
  nextId: number;
  selectedId: number | null;
}

/** A gesture is a drag or an eraser stroke: from pointer down to pointer up, one step at most. */
type GesturePhase = "none" | "waiting" | "recorded";

export interface History {
  past: DiscContent[]; // oldest first
  present: DiscContent; // the last committed content
  future: DiscContent[]; // the next redo first
  lastKey: string | null; // what kind of change the last step holds
  lastAt: number;
  sealed: boolean; // the next change never merges into the last step
  gesture: GesturePhase;
}

export interface HistoryMove {
  history: History;
  content: DiscContent;
}

// #region Comparing
// Fields that differ between two plain objects, by identity of each value.
function changedFields(before: object, after: object): string[] {
  const oldValues = new Map(Object.entries(before));
  const newValues = new Map(Object.entries(after));
  const names = new Set([...oldValues.keys(), ...newValues.keys()]);
  return [...names].filter((name) => !Object.is(oldValues.get(name), newValues.get(name)));
}

function sameImageKeys(
  before: ReadonlyMap<string, LoadedImage>,
  after: ReadonlyMap<string, LoadedImage>,
): boolean {
  return before.size === after.size && [...after.keys()].every((key) => before.has(key));
}

/** True when two contents hold the same things: settings by field, layers by identity. The selection does not count. */
export function sameContent(before: DiscContent, after: DiscContent): boolean {
  return (
    changedFields(before.settings, after.settings).length === 0 &&
    before.layers.length === after.layers.length &&
    before.layers.every((layer, index) => layer === after.layers[index]) &&
    before.mask === after.mask &&
    sameImageKeys(before.images, after.images)
  );
}

interface LayerEdit {
  before: Layer;
  after: Layer;
}

// The layers that differ, or null when the list changed shape (an add, a delete, a reorder).
function editedLayers(before: Layer[], after: Layer[]): LayerEdit[] | null {
  if (before.length !== after.length) return null;
  const edits: LayerEdit[] = [];
  for (const [index, layer] of before.entries()) {
    const next = after[index];
    if (!next || next.id !== layer.id) return null;
    if (next !== layer) edits.push({ before: layer, after: next });
  }
  return edits;
}

/**
 * The kind of a change, for merging: `settings:<field>` when one setting changed, `layer:<id>:<fields>`
 * when one layer changed, else null (an add, a delete, a reorder, a mask upload, a mix).
 */
export function changeKey(before: DiscContent, after: DiscContent): string | null {
  if (before.mask !== after.mask || !sameImageKeys(before.images, after.images)) return null;
  const edits = editedLayers(before.layers, after.layers);
  if (edits === null) return null;
  const settingFields = changedFields(before.settings, after.settings);
  const [edit] = edits;
  if (!edit) return settingFields.length === 1 ? `settings:${settingFields[0]}` : null;
  if (edits.length > 1 || settingFields.length > 0) return null;
  return `layer:${edit.after.id}:${changedFields(edit.before, edit.after).sort().join(",")}`;
}
// #endregion

/** True when the committed content differs from `saved`, the content of the last save or open. Undo back to it is clean again. */
export function isDirty(history: History, saved: DiscContent): boolean {
  return !sameContent(history.present, saved);
}

// #region Recording
export function resetHistory(content: DiscContent): History {
  return {
    past: [],
    present: { ...content, images: new Map(content.images) },
    future: [],
    lastKey: null,
    lastAt: 0,
    sealed: true,
    gesture: "none",
  };
}

// WHY: the document adds images to its own map in place, so a snapshot keeps its own copy, and
// reuses it while the keys stay the same (a snapshot is then six references, not a copy).
function snapshotOf(previous: DiscContent, current: DiscContent): DiscContent {
  const images = sameImageKeys(previous.images, current.images)
    ? previous.images
    : new Map(current.images);
  return { ...current, images };
}

function mergesIntoLastStep(history: History, key: string | null, now: number): boolean {
  if (history.gesture !== "none") return history.gesture === "recorded";
  return (
    !history.sealed &&
    key !== null &&
    key === history.lastKey &&
    now - history.lastAt <= MERGE_WINDOW_MS
  );
}

/** The history after the document changed to `current`: a new step, a merge into the last one, or nothing for a selection alone. */
export function recordChange(history: History, current: DiscContent, now: number): History {
  const content = snapshotOf(history.present, current);
  if (sameContent(history.present, content)) return { ...history, present: content };
  const key = changeKey(history.present, content);
  const merges = mergesIntoLastStep(history, key, now);
  return {
    past: merges ? history.past : [...history.past, history.present].slice(-MAX_HISTORY_STEPS),
    present: content,
    future: [],
    lastKey: key,
    lastAt: now,
    sealed: false,
    gesture: history.gesture === "waiting" ? "recorded" : history.gesture,
  };
}

export function beginGesture(history: History): History {
  return { ...history, gesture: "waiting" };
}

export function endGesture(history: History): History {
  return { ...history, gesture: "none", sealed: true };
}
// #endregion

// #region Walking
/** One step back: the content to restore, or null at the start. */
export function undo(history: History): HistoryMove | null {
  const content = history.past[history.past.length - 1];
  if (!content) return null;
  return {
    content,
    history: {
      ...history,
      past: history.past.slice(0, -1),
      present: content,
      future: [history.present, ...history.future],
      sealed: true,
      gesture: "none",
    },
  };
}

/** One step forward: the content to restore, or null at the end. */
export function redo(history: History): HistoryMove | null {
  const [content, ...rest] = history.future;
  if (!content) return null;
  return {
    content,
    history: {
      ...history,
      past: [...history.past, history.present],
      present: content,
      future: rest,
      sealed: true,
      gesture: "none",
    },
  };
}
// #endregion
