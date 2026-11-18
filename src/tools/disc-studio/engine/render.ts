// Draws a Disc Studio document: the masks, every layer, the print (compose) and the view (draw).
// Ports buildMasks, the layer drawing and draw of disc-studio.html (lines 138-192, 197-314); the
// parity test in tests/disc-parity is the final judge, so the order of canvas operations is kept
// exactly as the original has it.
import {
  bandArcPath,
  builtinMaskRadii,
  canvasSize,
  cutRadii,
  guideRadii,
  layerBox,
  pxPerMm,
  TEXT_LINE_HEIGHT,
  TEXT_MEASURE_SCALE,
  type Box,
  type BoxSource,
} from "./geometry";
import { maskAlphaFromPixels } from "./maskAlpha";
import type { DiscDocument } from "./document";
import type { ImageLayer, Layer, Stroke, TextLayer } from "./project";

const FULL_TURN = Math.PI * 2;
const HALF_TURN_DEGREES = 180;
const BOLD_WEIGHT = 700;
const REGULAR_WEIGHT = 400;
const ZONE_TINT = "rgba(220,40,40,0.18)";
const GUIDE_CUT_COLOUR = "#e00";
const GUIDE_SAFE_COLOUR = "#fff";
const SELECTION_COLOUR = "#3aa0ff";
const SELECTION_DASH = [10, 6];
const BRUSH_DASH = [6, 6];
// Line widths grow with the canvas but never fall under 2 px.
const MIN_LINE_PX = 2;
const GUIDE_WIDTH_DIVISOR = 400;
const SELECTION_WIDTH_DIVISOR = 500;
const BRUSH_WIDTH_DIVISOR = 600;
const GUIDE_DASH_ON = 6;
const GUIDE_DASH_OFF = 4;
// Softness thins the stroke and blurs its edge; both are shares of the brush radius.
const SOFT_THINNING = 0.5;
const SOFT_BLUR = 0.5;

/** The CSS font of a text layer, with its size in mm times `scale` (pixels per mm, or 10 to measure). */
export function fontString(layer: TextLayer, scale: number): string {
  return `${layer.italic ? "italic " : ""}${layer.bold ? BOLD_WEIGHT : REGULAR_WEIGHT} ${layer.size * scale}px "${layer.font}"`;
}

function makeCanvas(side: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = side;
  return canvas;
}

function contextOf(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser gave no 2d canvas context.");
  return context;
}

function addRing(path: Path2D, centre: number, radius: number): void {
  if (radius <= 0) return;
  path.moveTo(centre + radius, centre);
  path.arc(centre, centre, radius, 0, FULL_TURN);
}

interface Canvases {
  disc: HTMLCanvasElement; // the cut shape with bleed
  mask: HTMLCanvasElement; // where ink may go
  zone: HTMLCanvasElement; // the red tint where the mask gives no ink
  print: HTMLCanvasElement; // the composed print
  scratch: HTMLCanvasElement; // one layer at a time
  eraser: HTMLCanvasElement;
}

export class DiscRenderer implements BoxSource {
  private canvases!: Canvases;
  private readonly measuring = contextOf(makeCanvas(1));

  constructor(
    private readonly discDocument: DiscDocument,
    private readonly view: HTMLCanvasElement,
  ) {
    this.buildMasks();
  }

  // #region Measuring
  imageHeightOverWidth(imageId: string): number {
    const { img } = this.imageOf(imageId);
    return img.naturalHeight / img.naturalWidth;
  }

  measureLine(layer: TextLayer, line: string): number {
    this.measuring.font = fontString(layer, TEXT_MEASURE_SCALE);
    this.measuring.letterSpacing = `${layer.spacing * TEXT_MEASURE_SCALE}px`;
    return this.measuring.measureText(line).width;
  }

  boxOf(layer: Layer): Box {
    return layerBox(layer, this);
  }

  private imageOf(imageId: string): { img: HTMLImageElement } {
    const loaded = this.discDocument.images.get(imageId);
    if (!loaded) throw new Error(`The project has no image "${imageId}".`);
    return loaded;
  }
  // #endregion

  // #region Masks
  /** Rebuilds every canvas from the settings. Call it whenever a setting that changes the disc changes. */
  buildMasks(): void {
    const { settings, mask } = this.discDocument;
    const size = canvasSize(settings);
    const centre = size / 2;
    this.view.width = this.view.height = size;
    const print = makeCanvas(size);
    const scratch = makeCanvas(size);
    const eraser = makeCanvas(size);

    const disc = makeCanvas(size);
    const cut = cutRadii(settings);
    const cutPath = new Path2D();
    addRing(cutPath, centre, cut.outer);
    addRing(cutPath, centre, cut.inner);
    contextOf(disc).fill(cutPath, "evenodd");

    const maskCanvas = makeCanvas(size);
    const maskContext = contextOf(maskCanvas);
    if (settings.maskMode === "upload" && mask) {
      maskContext.drawImage(mask.img, 0, 0, size, size);
      const pixels = maskContext.getImageData(0, 0, size, size);
      pixels.data.set(maskAlphaFromPixels(pixels.data));
      maskContext.putImageData(pixels, 0, 0);
    } else if (settings.maskMode === "builtin") {
      const radii = builtinMaskRadii(settings);
      const maskPath = new Path2D();
      addRing(maskPath, centre, radii.outer);
      addRing(maskPath, centre, radii.inner);
      maskContext.fill(maskPath, "evenodd");
      const band = bandArcPath(settings);
      if (band) {
        maskContext.globalCompositeOperation = "destination-out";
        maskContext.fill(new Path2D(band));
        maskContext.globalCompositeOperation = "source-over";
      }
    } else {
      maskContext.drawImage(disc, 0, 0);
    }
    maskContext.globalCompositeOperation = "destination-in";
    maskContext.drawImage(disc, 0, 0);
    maskContext.globalCompositeOperation = "source-over";

    const zone = makeCanvas(size);
    const zoneContext = contextOf(zone);
    const guides = guideRadii(settings);
    const zonePath = new Path2D();
    addRing(zonePath, centre, guides.cut);
    addRing(zonePath, centre, guides.hole);
    zoneContext.fillStyle = ZONE_TINT;
    zoneContext.fill(zonePath, "evenodd");
    zoneContext.globalCompositeOperation = "destination-out";
    zoneContext.drawImage(maskCanvas, 0, 0);

    this.canvases = { disc, mask: maskCanvas, zone, print, scratch, eraser };
  }
  // #endregion

  // #region Layers
  // Puts the layer's centre, turn and mirror on the context. Everything after it is in pixels per mm.
  private applyLayerTransform(context: CanvasRenderingContext2D, layer: Layer): void {
    const pixels = pxPerMm(this.discDocument.settings.dpi);
    const centre = canvasSize(this.discDocument.settings) / 2;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.translate(centre + layer.x * pixels, centre + layer.y * pixels);
    context.rotate((layer.rot * Math.PI) / HALF_TURN_DEGREES);
    if (layer.flip) context.scale(-1, 1);
  }

  // One stroke on the eraser canvas, in the layer's own units (see toLocal in geometry.ts).
  private paintStroke(
    context: CanvasRenderingContext2D,
    layer: Layer,
    stroke: Stroke,
    unit: number,
  ): void {
    this.applyLayerTransform(context, layer);
    context.scale(unit, unit);
    context.globalCompositeOperation =
      stroke.mode === "restore" ? "source-over" : "destination-out";
    // The blur is in canvas pixels, so it is scaled from mm.
    context.filter =
      stroke.soft > 0 ? `blur(${stroke.soft * stroke.r * unit * SOFT_BLUR}px)` : "none";
    context.lineWidth = stroke.r * 2 * (stroke.soft > 0 ? 1 - stroke.soft * SOFT_THINNING : 1);
    context.beginPath();
    stroke.pts.forEach(([u, v], index) => (index ? context.lineTo(u, v) : context.moveTo(u, v)));
    const [onlyPoint] = stroke.pts.length === 1 ? stroke.pts : [];
    if (onlyPoint) context.lineTo(onlyPoint[0], onlyPoint[1]);
    context.stroke();
  }

  private applyErase(target: CanvasRenderingContext2D, layer: Layer): void {
    if (!layer.erase || !layer.erase.length) return;
    const { settings } = this.discDocument;
    const size = canvasSize(settings);
    const eraser = contextOf(this.canvases.eraser);
    const unit = this.boxOf(layer).width * pxPerMm(settings.dpi);
    eraser.setTransform(1, 0, 0, 1, 0, 0);
    eraser.globalCompositeOperation = "source-over";
    eraser.filter = "none";
    eraser.clearRect(0, 0, size, size);
    eraser.fillStyle = "#000";
    eraser.fillRect(0, 0, size, size);
    eraser.lineCap = "round";
    eraser.lineJoin = "round";
    eraser.strokeStyle = "#000";
    for (const stroke of layer.erase) this.paintStroke(eraser, layer, stroke, unit);
    eraser.setTransform(1, 0, 0, 1, 0, 0);
    eraser.globalCompositeOperation = "source-over";
    eraser.filter = "none";
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.globalCompositeOperation = "destination-in";
    target.drawImage(this.canvases.eraser, 0, 0);
    target.globalCompositeOperation = "source-over";
  }

  private drawImageLayer(target: CanvasRenderingContext2D, layer: ImageLayer): void {
    const { settings } = this.discDocument;
    const pixels = pxPerMm(settings.dpi);
    const { width, height } = this.boxOf(layer);
    target.drawImage(
      this.imageOf(layer.img).img,
      (-width * pixels) / 2,
      (-height * pixels) / 2,
      width * pixels,
      height * pixels,
    );
    if (layer.tint) {
      // Recolour: every painted pixel becomes one colour, the edges stay smooth.
      const size = canvasSize(settings);
      target.setTransform(1, 0, 0, 1, 0, 0);
      target.globalCompositeOperation = "source-in";
      // A tint with no colour keeps the previous fill, as the original does.
      if (layer.tintColor !== undefined) target.fillStyle = layer.tintColor;
      target.fillRect(0, 0, size, size);
      target.globalCompositeOperation = "source-over";
    }
  }

  private drawTextLayer(target: CanvasRenderingContext2D, layer: TextLayer): void {
    const pixels = pxPerMm(this.discDocument.settings.dpi);
    target.font = fontString(layer, pixels);
    target.letterSpacing = `${layer.spacing * pixels}px`;
    target.textAlign = "center";
    target.textBaseline = "middle";
    const lines = layer.text.split("\n");
    const lineHeight = layer.size * TEXT_LINE_HEIGHT * pixels;
    lines.forEach((line, index) => {
      const y = (index - (lines.length - 1) / 2) * lineHeight;
      if (layer.strokeW > 0) {
        target.lineJoin = "round";
        target.lineWidth = layer.strokeW * pixels * 2;
        target.strokeStyle = layer.stroke;
        target.strokeText(line, 0, y);
      }
      target.fillStyle = layer.color;
      target.fillText(line, 0, y);
    });
  }

  private drawLayer(target: CanvasRenderingContext2D, layer: Layer): void {
    this.applyLayerTransform(target, layer);
    if (layer.type === "image") this.drawImageLayer(target, layer);
    else this.drawTextLayer(target, layer);
    target.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** The print: every visible layer on a transparent canvas, where transparent means no ink. */
  compose(): HTMLCanvasElement {
    const size = canvasSize(this.discDocument.settings);
    const output = contextOf(this.canvases.print);
    const scratch = contextOf(this.canvases.scratch);
    output.clearRect(0, 0, size, size);
    for (const layer of this.discDocument.layers) {
      if (!layer.visible) continue;
      scratch.globalCompositeOperation = "source-over";
      scratch.clearRect(0, 0, size, size);
      this.drawLayer(scratch, layer);
      this.applyErase(scratch, layer);
      if (layer.clip !== "none") {
        scratch.globalCompositeOperation = "destination-in";
        scratch.drawImage(layer.clip === "mask" ? this.canvases.mask : this.canvases.disc, 0, 0);
        scratch.globalCompositeOperation = "source-over";
      }
      output.globalAlpha = layer.opacity;
      output.drawImage(this.canvases.scratch, 0, 0);
      output.globalAlpha = 1;
    }
    output.globalCompositeOperation = "destination-in";
    output.drawImage(this.canvases.disc, 0, 0);
    output.globalCompositeOperation = "source-over";
    return this.canvases.print;
  }
  // #endregion

  // #region View
  private drawGuides(view: CanvasRenderingContext2D, size: number): void {
    const centre = size / 2;
    const guides = guideRadii(this.discDocument.settings);
    const lineWidth = Math.max(MIN_LINE_PX, size / GUIDE_WIDTH_DIVISOR);
    const circle = (radius: number, colour: string, dashed: boolean): void => {
      view.beginPath();
      view.arc(centre, centre, radius, 0, FULL_TURN);
      view.lineWidth = lineWidth;
      view.strokeStyle = colour;
      view.setLineDash(dashed ? [lineWidth * GUIDE_DASH_ON, lineWidth * GUIDE_DASH_OFF] : []);
      view.stroke();
    };
    circle(guides.cut, GUIDE_CUT_COLOUR, false);
    circle(guides.safe, GUIDE_SAFE_COLOUR, true);
    if (this.discDocument.settings.hole > 0) {
      circle(guides.hole, GUIDE_CUT_COLOUR, false);
      circle(guides.holeSafe, GUIDE_SAFE_COLOUR, true);
    }
    view.setLineDash([]);
  }

  private drawSelectionBox(view: CanvasRenderingContext2D, size: number, selected: Layer): void {
    const pixels = pxPerMm(this.discDocument.settings.dpi);
    const centre = size / 2;
    const { width, height } = this.boxOf(selected);
    view.translate(centre + selected.x * pixels, centre + selected.y * pixels);
    view.rotate((selected.rot * Math.PI) / HALF_TURN_DEGREES);
    view.lineWidth = Math.max(MIN_LINE_PX, size / SELECTION_WIDTH_DIVISOR);
    view.strokeStyle = SELECTION_COLOUR;
    view.setLineDash(SELECTION_DASH);
    view.strokeRect((-width * pixels) / 2, (-height * pixels) / 2, width * pixels, height * pixels);
    view.setTransform(1, 0, 0, 1, 0, 0);
    view.setLineDash([]);
  }

  private drawBrushOutline(
    view: CanvasRenderingContext2D,
    size: number,
    hover: readonly [number, number],
  ): void {
    const pixels = pxPerMm(this.discDocument.settings.dpi);
    const centre = size / 2;
    view.beginPath();
    view.arc(
      centre + hover[0] * pixels,
      centre + hover[1] * pixels,
      (this.discDocument.brushMm / 2) * pixels,
      0,
      FULL_TURN,
    );
    view.lineWidth = Math.max(MIN_LINE_PX, size / BRUSH_WIDTH_DIVISOR);
    view.strokeStyle = "#000";
    view.stroke();
    view.setLineDash(BRUSH_DASH);
    view.strokeStyle = "#fff";
    view.stroke();
    view.setLineDash([]);
  }

  /** The view canvas: bare PLA, the red zones, the print, the guides and, with `withSelection`, the selection box and brush. */
  draw(withSelection = true): void {
    const { settings, selected, tool, hover } = this.discDocument;
    const size = canvasSize(settings);
    const centre = size / 2;
    const view = contextOf(this.view);
    view.setTransform(1, 0, 0, 1, 0, 0);
    view.fillStyle = settings.bg;
    view.fillRect(0, 0, size, size);
    const guides = guideRadii(settings);
    const plaPath = new Path2D();
    addRing(plaPath, centre, guides.cut);
    addRing(plaPath, centre, guides.hole);
    view.fillStyle = settings.pla;
    view.fill(plaPath, "evenodd");
    if (settings.zones) view.drawImage(this.canvases.zone, 0, 0);
    view.drawImage(this.compose(), 0, 0);
    if (settings.guides) this.drawGuides(view, size);
    if (withSelection && selected && selected.visible) this.drawSelectionBox(view, size, selected);
    if (withSelection && tool !== "move" && hover) this.drawBrushOutline(view, size, hover);
  }
  // #endregion
}
