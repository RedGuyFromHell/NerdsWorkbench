// What the Disc Studio screen does to a DiscDocument: select, edit, reorder, duplicate and delete
// layers, change settings, add text and images. Each one changes the document, then calls
// markChanged() once, so panels and canvas follow. The decisions live in the pure modules; this
// file is the wiring (and the file and image I/O).
import { TEXT_MEASURE_SCALE } from "./geometry";
import {
  isImageFile,
  isSvgFile,
  layerNameFromFile,
  lowDpiWarning,
  newImageLayer,
  newTextLayer,
  textLayerName,
} from "./addLayer";
import { loadImage, type DiscDocument } from "./document";
import { duplicateLayer, fitImageLayer, moveLayer } from "./layerOps";
import { settingNeedsMaskRebuild, type DiscSettings, type Layer, type TextLayer } from "./project";
import { fontString } from "./render";
import { prepareSvg } from "./svg";

const IMAGE_OPEN_ERROR = "This image cannot be opened.";

// #region Layers
export function selectLayer(discDocument: DiscDocument, layer: Layer | null): void {
  discDocument.selected = layer;
  discDocument.markChanged();
}

/** Puts `next` in place of the layer with the same id, and keeps it selected if the old one was. */
export function replaceLayer(discDocument: DiscDocument, next: Layer): void {
  discDocument.layers = discDocument.layers.map((layer) => (layer.id === next.id ? next : layer));
  if (discDocument.selected?.id === next.id) discDocument.selected = next;
  discDocument.markChanged();
}

export function patchLayer<L extends Layer>(
  discDocument: DiscDocument,
  layer: L,
  patch: Partial<L>,
): void {
  replaceLayer(discDocument, { ...layer, ...patch });
}

// WHY: the font may not be loaded yet, and the box and the drawing both need it; a redraw once it is.
function redrawWhenFontLoads(discDocument: DiscDocument, layer: TextLayer): void {
  document.fonts.load(fontString(layer, TEXT_MEASURE_SCALE)).then(
    () => discDocument.requestDraw(),
    () => undefined, // swallow: a font that cannot load leaves the fallback font on the canvas
  );
}

export function patchTextLayer(
  discDocument: DiscDocument,
  layer: TextLayer,
  patch: Partial<TextLayer>,
): void {
  const next: TextLayer = { ...layer, ...patch };
  if (patch.text !== undefined) next.name = textLayerName(patch.text);
  replaceLayer(discDocument, next);
  if (patch.font !== undefined || patch.bold !== undefined || patch.italic !== undefined) {
    redrawWhenFontLoads(discDocument, next);
  }
}

export function deleteLayer(discDocument: DiscDocument, layerId: number): void {
  discDocument.layers = discDocument.layers.filter((layer) => layer.id !== layerId);
  if (discDocument.selected?.id === layerId) discDocument.selected = null;
  discDocument.markChanged();
}

/** 1 moves the layer up (drawn later), -1 down. */
export function reorderLayer(discDocument: DiscDocument, layerId: number, direction: 1 | -1): void {
  discDocument.layers = moveLayer(discDocument.layers, layerId, direction);
  discDocument.markChanged();
}

export function duplicateSelected(discDocument: DiscDocument): void {
  const { selected } = discDocument;
  if (!selected) return;
  const { layers, copy } = duplicateLayer(discDocument.layers, selected.id, discDocument.nextId++);
  discDocument.layers = layers;
  discDocument.selected = copy;
  discDocument.markChanged();
}

export function centreSelected(discDocument: DiscDocument): void {
  const { selected } = discDocument;
  if (selected) patchLayer(discDocument, selected, { x: 0, y: 0 });
}

/** Sizes the selected image to cover the disc or to fit inside it, and centres it. */
export function fitSelectedImage(discDocument: DiscDocument, mode: "cover" | "fit"): void {
  const { selected } = discDocument;
  if (selected?.type !== "image") return;
  const natural = discDocument.renderer.imageNaturalSize(selected.img);
  const aspect = natural.width / natural.height;
  replaceLayer(discDocument, fitImageLayer(selected, mode, aspect, discDocument.settings.d));
}
// #endregion

// #region Settings
export function patchSetting<K extends keyof DiscSettings>(
  discDocument: DiscDocument,
  key: K,
  value: DiscSettings[K],
): void {
  discDocument.settings = { ...discDocument.settings, [key]: value };
  if (settingNeedsMaskRebuild(key)) discDocument.renderer.buildMasks();
  discDocument.markChanged();
}
// #endregion

// #region Adding
export function addTextLayer(discDocument: DiscDocument): void {
  const layer = newTextLayer(discDocument.nextId++, discDocument.settings);
  discDocument.layers = [...discDocument.layers, layer];
  discDocument.selected = layer;
  discDocument.markChanged();
  redrawWhenFontLoads(discDocument, layer);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(IMAGE_OPEN_ERROR));
    reader.readAsDataURL(file);
  });
}

// An SVG is rewritten so it draws sharp at any size; any other image stays as it is.
async function imageSource(file: File): Promise<string> {
  return isSvgFile(file) ? prepareSvg(await file.text()) : readAsDataUrl(file);
}

async function addImageFile(
  discDocument: DiscDocument,
  file: File,
  report: (text: string) => void,
): Promise<void> {
  const src = await imageSource(file);
  const img = await loadImage(src).catch(() => {
    throw new Error(IMAGE_OPEN_ERROR);
  });
  const imageId = `i${discDocument.nextId++}`;
  discDocument.images.set(imageId, { img, src });
  const name = layerNameFromFile(file.name);
  const layer = newImageLayer({
    id: discDocument.nextId++,
    imageId,
    name,
    natural: { width: img.naturalWidth, height: img.naturalHeight },
    settings: discDocument.settings,
    hasLayers: discDocument.layers.length > 0,
  });
  discDocument.layers = [...discDocument.layers, layer];
  discDocument.selected = layer;
  discDocument.markChanged();
  const warning = lowDpiWarning({
    name,
    naturalWidth: img.naturalWidth,
    widthMm: layer.w,
    dpi: discDocument.settings.dpi,
    vector: isSvgFile(file),
  });
  if (warning) report(warning);
}

/** Adds each image file as a layer, one after the other. A file that fails is reported and skipped. */
export async function addImageFiles(
  discDocument: DiscDocument,
  files: Iterable<File>,
  report: (text: string) => void,
): Promise<void> {
  for (const file of files) {
    if (!isImageFile(file)) continue;
    try {
      await addImageFile(discDocument, file, report);
    } catch (error) {
      report(`${file.name}: ${error instanceof Error ? error.message : IMAGE_OPEN_ERROR}`);
    }
  }
}
// #endregion
