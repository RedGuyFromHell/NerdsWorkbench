// What the tools and shortcut keys do to a DiscDocument: pick a tool, set the brush, draw an
// eraser stroke, and run a key command. Each changes the document, then calls
// markChanged() once (or requestDraw() when only the canvas needs to follow).
import { toLocal, type Point } from "./geometry";
import { deleteLayer, duplicateSelected, replaceLayer } from "./actions";
import type { DiscDocument, Tool } from "./document";
import type { KeyCommand } from "./keys";
import {
  addStrokePoint,
  appendStroke,
  clearStrokes,
  nudgeLayer,
  replaceLastStroke,
  startStroke,
} from "./layerOps";
import type { Layer, Stroke } from "./project";

/** The stroke being drawn and the layer it is on. */
export interface ActiveStroke {
  layerId: number;
  stroke: Stroke;
}

// #region Tool and brush
export function setTool(discDocument: DiscDocument, tool: Tool): void {
  discDocument.tool = tool;
  discDocument.markChanged();
}

export function setBrush(discDocument: DiscDocument, brushMm: number): void {
  discDocument.brushMm = brushMm;
  discDocument.markChanged();
}

export function setSoftness(discDocument: DiscDocument, soft: number): void {
  discDocument.soft = soft;
  discDocument.markChanged();
}
// #endregion

// #region Eraser strokes
const localPoint = (discDocument: DiscDocument, layer: Layer, point: Point): Point =>
  toLocal(layer, point, discDocument.renderer.boxOf(layer).width);

/** Starts a stroke at `point` (mm from the disc centre) on the layer, in the current tool's mode. */
export function beginStroke(discDocument: DiscDocument, layer: Layer, point: Point): ActiveStroke {
  const stroke = startStroke({
    mode: discDocument.tool === "restore" ? "restore" : "erase",
    brushMm: discDocument.brushMm,
    soft: discDocument.soft,
    boxWidth: discDocument.renderer.boxOf(layer).width,
    point: localPoint(discDocument, layer, point),
  });
  replaceLayer(discDocument, appendStroke(layer, stroke));
  return { layerId: layer.id, stroke };
}

/** Adds the point to the stroke being drawn, unless it is too close to the last one. */
export function continueStroke(
  discDocument: DiscDocument,
  active: ActiveStroke,
  point: Point,
): ActiveStroke {
  const layer = discDocument.layers.find((candidate) => candidate.id === active.layerId);
  if (!layer) return active;
  const stroke = addStrokePoint(active.stroke, localPoint(discDocument, layer, point));
  if (stroke === active.stroke) {
    discDocument.requestDraw(); // the brush outline still follows the pointer
    return active;
  }
  replaceLayer(discDocument, replaceLastStroke(layer, stroke));
  return { layerId: layer.id, stroke };
}

export function clearEraser(discDocument: DiscDocument): void {
  const { selected } = discDocument;
  if (selected) replaceLayer(discDocument, clearStrokes(selected));
}
// #endregion

// #region Keys
export function runKeyCommand(discDocument: DiscDocument, command: KeyCommand): void {
  const { selected } = discDocument;
  switch (command.type) {
    case "tool":
      setTool(discDocument, command.tool);
      break;
    case "undo":
      discDocument.undo();
      break;
    case "redo":
      discDocument.redo();
      break;
    case "nudge":
      if (selected) replaceLayer(discDocument, nudgeLayer(selected, command.dx, command.dy));
      break;
    case "delete":
      if (selected) deleteLayer(discDocument, selected.id);
      break;
    case "duplicate":
      duplicateSelected(discDocument);
      break;
  }
}
// #endregion
