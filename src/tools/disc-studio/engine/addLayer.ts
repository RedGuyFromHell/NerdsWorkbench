// What adding a layer decides: the starting values of a text or an image layer, the low-DPI
// warning, and which dropped files are images. Mirrors addText, addImage and addFiles of
// disc-studio.html (lines 432-456). No canvas and no files are touched here.
import { coverWidth } from "./layerOps";
import { pxPerMm, type Box } from "./geometry";
import type { DiscSettings, ImageLayer, TextLayer } from "./project";

export const TEXT_FONTS = [
  "Cinzel",
  "Cinzel Decorative",
  "Bebas Neue",
  "Inter",
  "Georgia",
  "Arial",
  "Impact",
  "Times New Roman",
] as const;

export const DEFAULT_TINT_COLOUR = "#111111"; // the recolour colour until the user picks one
const MAX_LAYER_NAME_LENGTH = 30;
const LOW_DPI_TOLERANCE = 0.95; // the image may fall 5% short of the pixels the print needs

// #region New layers
/** A text layer in the middle of the built-in mask's band, or at the centre when there is none. */
export function newTextLayer(id: number, settings: DiscSettings): TextLayer {
  const inBand = settings.maskMode === "builtin" && settings.band > 0;
  return {
    id,
    type: "text",
    name: "NERD CASTLE",
    text: "NERD CASTLE",
    font: "Cinzel",
    size: 6,
    spacing: 0.4,
    color: "#1a1a1a",
    stroke: "#ffffff",
    strokeW: 0,
    bold: true,
    italic: false,
    x: 0,
    y: inBand ? settings.d / 2 - settings.band / 2 : 0,
    rot: 0,
    opacity: 1,
    clip: "disc",
    flip: false,
    visible: true,
  };
}

/** An image layer as wide as it takes to cover the disc. The first layer is clipped to the mask. */
export function newImageLayer(options: {
  id: number;
  imageId: string;
  name: string;
  natural: Box;
  settings: DiscSettings;
  hasLayers: boolean;
}): ImageLayer {
  const aspect = options.natural.width / options.natural.height;
  return {
    id: options.id,
    type: "image",
    name: options.name,
    img: options.imageId,
    x: 0,
    y: 0,
    w: coverWidth(aspect, options.settings.d),
    rot: 0,
    opacity: 1,
    clip: options.hasLayers ? "disc" : "mask",
    flip: false,
    visible: true,
  };
}

/** The layer's name for a text: its first line, cut at 30 characters. */
export function textLayerName(text: string): string {
  return (text.split("\n")[0] ?? "").slice(0, MAX_LAYER_NAME_LENGTH) || "Text";
}
// #endregion

/** A message when the image has fewer pixels than the print needs, else null. Vectors are always sharp. */
export function lowDpiWarning(options: {
  name: string;
  naturalWidth: number;
  widthMm: number;
  dpi: number;
  vector: boolean;
}): string | null {
  const pixelsNeeded = options.widthMm * pxPerMm(options.dpi);
  if (options.vector || options.naturalWidth >= pixelsNeeded * LOW_DPI_TOLERANCE) return null;
  return `${options.name}: ${options.naturalWidth}px wide, needs ${Math.round(pixelsNeeded)}px for ${options.dpi} dpi.`;
}

// #region Files
interface FileLike {
  type: string;
  name: string;
}

export const isSvgFile = (file: FileLike): boolean =>
  file.type === "image/svg+xml" || /\.svg$/i.test(file.name);

export const isImageFile = (file: FileLike): boolean =>
  file.type.startsWith("image/") || isSvgFile(file);

export const layerNameFromFile = (fileName: string): string => fileName.replace(/\.[^.]+$/, "");
// #endregion
