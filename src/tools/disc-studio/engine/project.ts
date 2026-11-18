// The Disc Studio project: its types, the settings defaults, and reading and writing the file.
// Field names mirror disc-studio.html (lines 119-123, 336-342, 440-447, 480-496) so a file saved by
// the HTML loads unchanged; the parity test in tests/disc-parity is the final judge.
import { z } from "zod";
import { DEFAULT_BACKGROUND_COLOUR, DEFAULT_PLA_COLOUR } from "./colours";

export const TOOL_ID = "disc-studio";
export const PROJECT_VERSION = 1;

// #region Schema
const strokeSchema = z.object({
  mode: z.enum(["erase", "restore"]),
  r: z.number(), // brush radius, as a share of the layer's own width
  soft: z.number(),
  pts: z.array(z.tuple([z.number(), z.number()])), // in the layer's own units
});

const placementFields = {
  id: z.number(),
  name: z.string(),
  x: z.number(), // mm from the disc centre
  y: z.number(),
  rot: z.number(), // degrees
  opacity: z.number(),
  clip: z.enum(["mask", "disc", "none"]),
  flip: z.boolean(),
  visible: z.boolean(),
  erase: z.array(strokeSchema).optional(),
};

const imageLayerSchema = z.object({
  ...placementFields,
  type: z.literal("image"),
  img: z.string(), // key into the project's images
  w: z.number(), // width in mm
  tint: z.boolean().optional(),
  tintColor: z.string().optional(),
});

const textLayerSchema = z.object({
  ...placementFields,
  type: z.literal("text"),
  text: z.string(),
  font: z.string(),
  size: z.number(), // mm
  spacing: z.number(), // mm
  color: z.string(),
  stroke: z.string(),
  strokeW: z.number(), // mm
  bold: z.boolean(),
  italic: z.boolean(),
});

const layerSchema = z.discriminatedUnion("type", [imageLayerSchema, textLayerSchema]);

const settingsSchema = z.object({
  d: z.number().default(120), // disc diameter, mm
  hole: z.number().default(15), // centre hole diameter, mm
  bleed: z.number().default(1),
  dpi: z.number().default(300),
  maskMode: z.enum(["builtin", "upload", "none"]).default("builtin"),
  margin: z.number().default(4),
  band: z.number().default(20),
  curve: z.number().default(12),
  guides: z.boolean().default(true),
  zones: z.boolean().default(true),
  pla: z.string().default(DEFAULT_PLA_COLOUR),
  bg: z.string().default(DEFAULT_BACKGROUND_COLOUR),
  name: z.string().default("disc-design"),
});

// What a file holds. Old files of the HTML have app and v; .nerd files have tool and version.
const fileSchema = z.object({
  S: settingsSchema.prefault({}),
  mask: z.string().nullish(),
  images: z.record(z.string(), z.string()).default({}),
  layers: z.array(layerSchema),
});
// #endregion

export type Stroke = z.infer<typeof strokeSchema>;
export type ImageLayer = z.infer<typeof imageLayerSchema>;
export type TextLayer = z.infer<typeof textLayerSchema>;
export type Layer = z.infer<typeof layerSchema>;
export type DiscSettings = z.infer<typeof settingsSchema>;

/** In memory the settings are called `settings`; in the file they are `S`, as in the HTML. */
export interface DiscProject {
  settings: DiscSettings;
  mask: string | null; // data URL of an uploaded mask
  images: Record<string, string>; // image id -> data URL
  layers: Layer[]; // bottom first
}

export const DEFAULT_SETTINGS: Readonly<DiscSettings> = settingsSchema.parse({});

// The settings that only change what is drawn on top, not the disc or the mask canvases.
const VIEW_ONLY_SETTINGS: readonly (keyof DiscSettings)[] = [
  "guides",
  "zones",
  "pla",
  "bg",
  "name",
];

/** Whether changing this setting means the masks must be rebuilt (not only a redraw). */
export function settingNeedsMaskRebuild(key: keyof DiscSettings): boolean {
  return !VIEW_ONLY_SETTINGS.includes(key);
}

// #region Reading and writing
const NOT_A_PROJECT = "Not a Disc Studio project.";
const NEWER_VERSION = "This project was saved by a newer version of Nerd's Workbench.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// A file belongs to Disc Studio when its tool (or, in old files, its app) says so.
function checkOwner(data: unknown): Record<string, unknown> {
  if (!isRecord(data)) throw new Error(NOT_A_PROJECT);
  const owners = [data.tool, data.app].filter((owner) => owner !== undefined);
  if (owners.length === 0 || owners.some((owner) => owner !== TOOL_ID)) {
    throw new Error(NOT_A_PROJECT);
  }
  const version = data.version ?? data.v ?? PROJECT_VERSION;
  if (version !== PROJECT_VERSION) throw new Error(NEWER_VERSION);
  return data;
}

/** The one place a project file becomes typed data. Throws an Error with a plain message. */
export function parseProject(text: string): DiscProject {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("The project file is not valid JSON.");
  }
  const file = fileSchema.safeParse(checkOwner(data));
  if (!file.success) {
    const issue = file.error.issues[0];
    const where = issue ? issue.path.join(".") : "";
    throw new Error(`The project file is damaged at "${where}": ${issue?.message ?? "unknown"}.`);
  }
  const { S, mask, images, layers } = file.data;
  return { settings: S, mask: mask || null, images, layers };
}

/**
 * The file text. Besides tool and version (the .nerd wrapper) it keeps app and v, so
 * disc-studio.html can still open a file saved here.
 */
export function serializeProject(project: DiscProject): string {
  return JSON.stringify({
    tool: TOOL_ID,
    version: PROJECT_VERSION,
    app: TOOL_ID,
    v: PROJECT_VERSION,
    S: project.settings,
    mask: project.mask,
    images: project.images,
    layers: project.layers,
  });
}
// #endregion

/** One past the highest layer id and the highest image id ("i" + number). */
export function nextLayerId(layers: readonly { id: number }[], imageIds: Iterable<string>): number {
  const imageNumbers = [...imageIds].map((id) => Number(id.slice(1))).filter(Number.isFinite);
  return 1 + Math.max(0, ...layers.map((layer) => layer.id), ...imageNumbers);
}
