// The projects the parity test renders through disc-studio.html and through the port.
// The builders run in the browser: they draw their test images on a canvas, so no image file is committed.
import {
  DEFAULT_SETTINGS,
  serializeProject,
  type DiscProject,
  type ImageLayer,
  type Stroke,
  type TextLayer,
} from "../../src/tools/disc-studio/engine/project";
import type { Tool } from "../../src/tools/disc-studio/engine/document";

export interface ViewState {
  /** Index into the project's layers, or null for no selection. */
  selectedIndex: number | null;
  tool: Tool;
  /** Pointer position in mm from the disc centre, or null. */
  hover: [number, number] | null;
  brushMm: number;
  /** Whether the view canvas is drawn with the selection box and brush outline (`draw(true)`). */
  withSelection: boolean;
}

export interface FixtureCase {
  /** The text of a project file, as both pages open it. */
  projectText: string;
  view: ViewState;
}

const NO_VIEW: ViewState = {
  selectedIndex: null,
  tool: "move",
  hover: null,
  brushMm: 5,
  withSelection: false,
};

// #region Test images
function pngDataUrl(
  width: number,
  height: number,
  paint: (context: CanvasRenderingContext2D) => void,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No 2d canvas context.");
  paint(context);
  return canvas.toDataURL("image/png");
}

/** Colourful art with smooth edges and a see-through hole, so alpha and scaling both show. */
function artworkUrl(width: number, height: number): string {
  return pngDataUrl(width, height, (context) => {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#c0392b");
    gradient.addColorStop(0.5, "#f1c40f");
    gradient.addColorStop(1, "#2980b9");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#111";
    context.lineWidth = 7;
    for (let offset = -height; offset < width; offset += 60) {
      context.beginPath();
      context.moveTo(offset, 0);
      context.lineTo(offset + height, height);
      context.stroke();
    }
    context.fillStyle = "#27ae60";
    context.beginPath();
    context.arc(width * 0.3, height * 0.65, height * 0.25, 0, Math.PI * 2);
    context.fill();
    context.globalCompositeOperation = "destination-out";
    context.beginPath();
    context.arc(width * 0.62, height * 0.4, height * 0.18, 0, Math.PI * 2);
    context.fill();
  });
}

/** An opaque black-and-white mask: a white disc, a grey ramp through the luminance range, a black bar. */
function opaqueMaskUrl(side: number): string {
  return pngDataUrl(side, side, (context) => {
    context.fillStyle = "#000";
    context.fillRect(0, 0, side, side);
    context.fillStyle = "#fff";
    context.beginPath();
    context.arc(side / 2, side / 2, side * 0.4, 0, Math.PI * 2);
    context.fill();
    const ramp = context.createLinearGradient(0, 0, side, 0);
    ramp.addColorStop(0, "#000");
    ramp.addColorStop(1, "#fff");
    context.fillStyle = ramp;
    context.fillRect(0, side * 0.7, side, side * 0.1);
    context.fillStyle = "#000";
    context.fillRect(side * 0.4, 0, side * 0.2, side * 0.3);
  });
}

/** A mask with transparency: its alpha is the ink, the colour does not matter. */
function alphaMaskUrl(side: number): string {
  return pngDataUrl(side, side, (context) => {
    context.fillStyle = "rgba(255, 0, 0, 1)";
    context.beginPath();
    context.arc(side * 0.4, side * 0.5, side * 0.3, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "rgba(0, 0, 255, 0.5)";
    context.beginPath();
    context.arc(side * 0.62, side * 0.5, side * 0.3, 0, Math.PI * 2);
    context.fill();
  });
}

// The shape disc-studio.html's prepareSvg gives: a viewBox and a 4096 px long side.
function svgUrl(): string {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" width="4096" height="2458">' +
    '<rect x="2" y="2" width="96" height="56" rx="10" fill="#8e44ad"/>' +
    '<circle cx="30" cy="30" r="18" fill="#f39c12"/>' +
    '<path d="M55 12 L90 30 L55 48 Z" fill="#16a085" stroke="#111" stroke-width="2"/>' +
    "</svg>";
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
// #endregion

// #region Building projects
function imageLayer(overrides: Partial<ImageLayer> & Pick<ImageLayer, "id" | "img">): ImageLayer {
  return {
    type: "image",
    name: `Image ${overrides.id}`,
    x: 0,
    y: 0,
    w: 120,
    rot: 0,
    opacity: 1,
    clip: "disc",
    flip: false,
    visible: true,
    ...overrides,
  };
}

function textLayer(overrides: Partial<TextLayer> & Pick<TextLayer, "id">): TextLayer {
  return {
    type: "text",
    name: `Text ${overrides.id}`,
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
    y: 0,
    rot: 0,
    opacity: 1,
    clip: "disc",
    flip: false,
    visible: true,
    ...overrides,
  };
}

// Hard and soft, erase and restore, a path and single points (a single point is a dot).
const ERASE_STROKES: Stroke[] = [
  {
    mode: "erase",
    r: 0.06,
    soft: 0,
    pts: [
      [-0.4, -0.1],
      [-0.1, 0.05],
      [0.2, -0.1],
      [0.4, 0.1],
    ],
  },
  {
    mode: "erase",
    r: 0.1,
    soft: 0.8,
    pts: [
      [-0.3, 0.2],
      [0, 0.25],
      [0.3, 0.2],
    ],
  },
  {
    mode: "restore",
    r: 0.04,
    soft: 0,
    pts: [
      [-0.1, -0.2],
      [-0.1, 0.2],
    ],
  },
  {
    mode: "restore",
    r: 0.08,
    soft: 0.5,
    pts: [
      [0.15, 0],
      [0.3, 0.1],
    ],
  },
  { mode: "erase", r: 0.05, soft: 0, pts: [[0.35, -0.2]] },
  { mode: "erase", r: 0.07, soft: 0.3, pts: [[-0.35, 0.3]] },
];

function projectCase(project: DiscProject, view: Partial<ViewState> = {}): FixtureCase {
  return { projectText: serializeProject(project), view: { ...NO_VIEW, ...view } };
}
// #endregion

const DPI_100 = { ...DEFAULT_SETTINGS, dpi: 100 };

export const FIXTURES: Record<string, () => FixtureCase> = {
  "built-in mask with band and curve": () =>
    projectCase({
      settings: DPI_100,
      mask: null,
      images: { i1: artworkUrl(600, 400) },
      layers: [
        imageLayer({ id: 2, img: "i1", w: 150, clip: "mask" }),
        imageLayer({ id: 3, img: "i1", w: 60, x: 10, y: -20, rot: 15, opacity: 0.8 }),
      ],
    }),

  "uploaded opaque mask (luminance)": () =>
    projectCase({
      settings: { ...DPI_100, maskMode: "upload" },
      mask: opaqueMaskUrl(300),
      images: { i1: artworkUrl(600, 400) },
      layers: [imageLayer({ id: 2, img: "i1", w: 150, clip: "mask" })],
    }),

  "uploaded mask with transparency": () =>
    projectCase({
      settings: { ...DPI_100, maskMode: "upload" },
      mask: alphaMaskUrl(300),
      images: { i1: artworkUrl(600, 400) },
      layers: [imageLayer({ id: 2, img: "i1", w: 150, clip: "mask" })],
    }),

  "no mask, no hole, guides and zones off, own colours": () =>
    projectCase({
      settings: {
        ...DPI_100,
        maskMode: "none",
        hole: 0,
        guides: false,
        zones: false,
        pla: "#223344",
        bg: "#ddeeff",
      },
      mask: null,
      images: { i1: artworkUrl(600, 400) },
      layers: [imageLayer({ id: 2, img: "i1", w: 130, clip: "mask" })],
    }),

  "text layers": () =>
    projectCase({
      settings: DPI_100,
      mask: null,
      images: { i1: artworkUrl(600, 400) },
      layers: [
        imageLayer({ id: 2, img: "i1", w: 150, clip: "mask" }),
        textLayer({ id: 3, y: 40 }),
        textLayer({
          id: 4,
          text: "BEBAS\nTWO LINES",
          font: "Bebas Neue",
          bold: false,
          size: 12,
          color: "#c0392b",
          strokeW: 0.6,
          x: -20,
          y: -10,
          rot: -20,
        }),
        textLayer({
          id: 5,
          text: "Decorative",
          font: "Cinzel Decorative",
          size: 8,
          x: 20,
          y: 10,
          flip: true,
        }),
        textLayer({
          id: 6,
          text: "Inter italic",
          font: "Inter",
          bold: false,
          italic: true,
          size: 7,
          spacing: 1.2,
          y: -40,
          color: "#ffffff",
          opacity: 0.7,
        }),
        textLayer({
          id: 7,
          text: "Cinzel italic",
          italic: true,
          bold: false,
          size: 5,
          x: -10,
          y: 25,
        }),
      ],
    }),

  "eraser and restore strokes on a rotated, mirrored layer": () =>
    projectCase({
      settings: DPI_100,
      mask: null,
      images: { i1: artworkUrl(600, 400) },
      layers: [
        imageLayer({
          id: 2,
          img: "i1",
          w: 100,
          x: 5,
          y: -5,
          rot: 30,
          flip: true,
          erase: ERASE_STROKES,
        }),
      ],
    }),

  "eraser strokes on a text layer": () =>
    projectCase({
      settings: DPI_100,
      mask: null,
      images: {},
      layers: [
        textLayer({
          id: 2,
          text: "ERASED",
          size: 20,
          y: 5,
          rot: -10,
          color: "#2c3e50",
          erase: ERASE_STROKES,
        }),
      ],
    }),

  "tint, opacity and the three clip modes": () =>
    projectCase({
      settings: DPI_100,
      mask: null,
      images: { i1: artworkUrl(600, 400) },
      layers: [
        imageLayer({ id: 2, img: "i1", w: 150, clip: "mask" }),
        imageLayer({
          id: 3,
          img: "i1",
          w: 70,
          x: -25,
          y: -20,
          tint: true,
          tintColor: "#ff00aa",
          opacity: 0.6,
        }),
        imageLayer({ id: 4, img: "i1", w: 70, x: 40, y: -45, rot: 45, clip: "none" }),
        textLayer({ id: 5, text: "FILL", color: "#00aa44", x: 30, y: 25 }),
        imageLayer({ id: 6, img: "i1", w: 40, x: 30, y: 25, tint: true, opacity: 0.9 }),
        imageLayer({ id: 7, img: "i1", w: 200, visible: false }),
      ],
    }),

  "svg layer": () =>
    projectCase({
      settings: DPI_100,
      mask: null,
      images: { i1: svgUrl() },
      layers: [
        imageLayer({ id: 2, img: "i1", w: 100, clip: "mask", rot: 10 }),
        imageLayer({ id: 3, img: "i1", w: 40, x: 25, y: 40, opacity: 0.8, flip: true }),
      ],
    }),

  "300 dpi: mask, art, text and a soft eraser": () =>
    projectCase({
      settings: { ...DEFAULT_SETTINGS, dpi: 300 },
      mask: null,
      images: { i1: artworkUrl(1200, 800) },
      layers: [
        imageLayer({ id: 2, img: "i1", w: 150, clip: "mask", rot: -8, erase: ERASE_STROKES }),
        textLayer({ id: 3, y: 45, size: 8 }),
      ],
    }),

  "selection box on a text layer, with the brush outline (300 dpi)": () =>
    projectCase(
      {
        settings: { ...DEFAULT_SETTINGS, dpi: 300 }, // 300 dpi so the line widths are above their 2 px floor
        mask: null,
        images: { i1: artworkUrl(600, 400) },
        layers: [
          imageLayer({ id: 2, img: "i1", w: 150, clip: "mask" }),
          textLayer({ id: 3, text: "SELECTED\nTEXT", y: 20, rot: 12, size: 9 }),
        ],
      },
      { selectedIndex: 1, tool: "erase", hover: [14, -9.5], brushMm: 8, withSelection: true },
    ),

  "selection box on a rotated image, restore tool": () =>
    projectCase(
      {
        settings: DPI_100,
        mask: null,
        images: { i1: artworkUrl(600, 400) },
        layers: [imageLayer({ id: 2, img: "i1", w: 90, x: -10, y: 8, rot: 33, flip: true })],
      },
      { selectedIndex: 0, tool: "restore", hover: [-20, 15], brushMm: 3, withSelection: true },
    ),
};

export const FIXTURE_NAMES = Object.keys(FIXTURES);
