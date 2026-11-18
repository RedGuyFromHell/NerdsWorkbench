// The open Disc Studio document: settings, layers, images and mask, with the mutate-then-redraw
// model of disc-studio.html. Callers change the fields, then call markChanged(); panels read the
// document through subscribe and getVersion (useSyncExternalStore), the canvas through requestDraw.
import { TEXT_MEASURE_SCALE, type Point } from "./geometry";
import {
  DEFAULT_SETTINGS,
  nextLayerId,
  type DiscProject,
  type DiscSettings,
  type Layer,
} from "./project";
import { DiscRenderer, fontString } from "./render";

export type Tool = "move" | "erase" | "restore";

export interface LoadedImage {
  img: HTMLImageElement;
  src: string; // the data URL the image came from, kept for saving
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("An image in this project cannot be opened."));
    img.src = src;
  });
}

export class DiscDocument {
  settings: DiscSettings = { ...DEFAULT_SETTINGS };
  layers: Layer[] = []; // bottom first
  images = new Map<string, LoadedImage>();
  mask: LoadedImage | null = null; // an uploaded mask
  selected: Layer | null = null;
  tool: Tool = "move";
  brushMm = 5; // eraser diameter
  hover: Point | null = null; // pointer in mm from the disc centre, shown as the brush outline
  nextId = 1;
  readonly renderer: DiscRenderer;

  private version = 0;
  private drawQueued = false;
  private readonly listeners = new Set<() => void>();

  constructor(view: HTMLCanvasElement) {
    this.renderer = new DiscRenderer(this, view);
  }

  // #region Store
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getVersion = (): number => this.version;

  /** Call after changing any field: tells the panels and queues a redraw. */
  markChanged(): void {
    this.version++;
    for (const listener of this.listeners) listener();
    this.requestDraw();
  }

  /** Draws once on the next frame, however many times it is called before then. */
  requestDraw(): void {
    if (this.drawQueued) return;
    this.drawQueued = true;
    requestAnimationFrame(() => {
      this.drawQueued = false;
      this.renderer.draw();
    });
  }
  // #endregion

  /** Replaces everything with a parsed project. A failed image load leaves the open one as it was. */
  async open(project: DiscProject): Promise<void> {
    const images = new Map<string, LoadedImage>();
    for (const [id, src] of Object.entries(project.images)) {
      images.set(id, { img: await loadImage(src), src });
    }
    const mask = project.mask ? { img: await loadImage(project.mask), src: project.mask } : null;
    const fontLoads = project.layers
      .filter((layer) => layer.type === "text")
      .map((layer) => document.fonts.load(fontString(layer, TEXT_MEASURE_SCALE)));
    await Promise.all(fontLoads);

    this.settings = { ...project.settings };
    this.images = images;
    this.mask = mask;
    this.layers = project.layers;
    this.selected = null;
    this.nextId = nextLayerId(this.layers, images.keys());
    this.renderer.buildMasks();
    this.markChanged();
  }
}
