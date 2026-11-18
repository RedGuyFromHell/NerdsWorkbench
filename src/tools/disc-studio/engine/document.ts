// The open Disc Studio document: settings, layers, images and mask, with the mutate-then-redraw
// model of disc-studio.html. Callers change the fields, then call markChanged(); panels read the
// document through subscribe and getVersion (useSyncExternalStore), the canvas through requestDraw.
import { TEXT_MEASURE_SCALE, type Point } from "./geometry";
import {
  beginGesture,
  endGesture,
  isDirty,
  recordChange,
  redo,
  resetHistory,
  undo,
  type DiscContent,
  type History,
  type HistoryMove,
} from "./history";
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
  soft = 0; // eraser edge: 0 hard to 1 very soft
  hover: Point | null = null; // pointer in mm from the disc centre, shown as the brush outline
  nextId = 1;
  readonly renderer: DiscRenderer;

  private history: History;
  private saved: DiscContent; // the content of the last save or open; isDirty compares against it
  private version = 0;
  private drawQueued = false;
  private readonly listeners = new Set<() => void>();

  constructor(readonly view: HTMLCanvasElement) {
    this.renderer = new DiscRenderer(this, view);
    this.history = resetHistory(this.content());
    this.saved = this.history.present;
  }

  // #region Store
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getVersion = (): number => this.version;

  /** Call after changing any field: records an undo step if the content changed, tells the panels and queues a redraw. */
  markChanged(): void {
    this.history = recordChange(this.history, this.content(), performance.now());
    this.notify();
    this.requestDraw();
  }

  private notify(): void {
    this.version++;
    for (const listener of this.listeners) listener();
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

  // #region History
  /** A drag or an eraser stroke: every change until endGesture is one undo step. */
  beginGesture(): void {
    this.history = beginGesture(this.history);
  }

  endGesture(): void {
    this.history = endGesture(this.history);
  }

  /** The content as last recorded: take it before writing a file, and hand it to markSaved after. */
  get committed(): DiscContent {
    return this.history.present;
  }

  /** True when the content differs from the last save or open. Export PNG does not count as a save. */
  isDirty(): boolean {
    return isDirty(this.history, this.saved);
  }

  /** The file holds `content` (what committed was when the write started). Tells the panels, so a watcher sees the flag flip. */
  markSaved(content: DiscContent): void {
    this.saved = content;
    this.notify();
  }

  get canUndo(): boolean {
    return this.history.past.length > 0;
  }

  get canRedo(): boolean {
    return this.history.future.length > 0;
  }

  undo(): void {
    this.restoreMove(undo(this.history));
  }

  redo(): void {
    this.restoreMove(redo(this.history));
  }

  private content(): DiscContent {
    return {
      settings: this.settings,
      layers: this.layers,
      images: this.images,
      mask: this.mask,
      nextId: this.nextId,
      selectedId: this.selected?.id ?? null,
    };
  }

  private restoreMove(move: HistoryMove | null): void {
    if (!move) return;
    const { content } = move;
    const masksChanged = this.settings !== content.settings || this.mask !== content.mask;
    this.history = move.history;
    this.settings = content.settings;
    this.layers = content.layers;
    this.images = new Map(content.images); // the document adds to its own map in place, the snapshot keeps its own
    this.mask = content.mask;
    this.nextId = content.nextId;
    this.selected = this.layers.find((layer) => layer.id === content.selectedId) ?? null;
    if (masksChanged) this.renderer.buildMasks();
    this.markChanged(); // sees the content already recorded: no new step
  }
  // #endregion

  /** Everything a project file keeps. */
  toProject(): DiscProject {
    return {
      settings: this.settings,
      mask: this.mask?.src ?? null,
      images: Object.fromEntries([...this.images].map(([id, loaded]) => [id, loaded.src])),
      layers: this.layers,
    };
  }

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
    this.history = resetHistory(this.content());
    this.saved = this.history.present;
    this.markChanged();
  }
}
