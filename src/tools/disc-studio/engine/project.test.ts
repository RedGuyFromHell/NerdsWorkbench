import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, nextLayerId, parseProject, serializeProject } from "./project";

// A project file exactly as disc-studio.html writes it: app and v, settings under "S".
const HTML_V1_FILE = JSON.stringify({
  app: "disc-studio",
  v: 1,
  S: {
    d: 100,
    hole: 10,
    bleed: 1,
    dpi: 300,
    maskMode: "upload",
    margin: 4,
    band: 20,
    curve: 12,
    guides: false,
    zones: true,
    pla: "#f4f2ec",
    bg: "#8a8a8a",
    name: "my-disc",
  },
  mask: "data:image/png;base64,TUFTSw==",
  images: { i1: "data:image/png;base64,SU1H", i4: "data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E" },
  layers: [
    {
      id: 2,
      type: "image",
      name: "logo",
      img: "i1",
      x: 1.5,
      y: -2,
      w: 120,
      rot: 15,
      opacity: 0.8,
      clip: "mask",
      flip: false,
      visible: true,
      tintColor: "#111111",
    },
    {
      id: 3,
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
      y: 50,
      rot: 0,
      opacity: 1,
      clip: "disc",
      flip: true,
      visible: true,
      erase: [
        {
          mode: "erase",
          r: 0.05,
          soft: 0.5,
          pts: [
            [0.1, 0.2],
            [0.15, 0.25],
          ],
        },
      ],
    },
  ],
});

describe("parseProject", () => {
  it("reads a v1 file written by disc-studio.html", () => {
    const project = parseProject(HTML_V1_FILE);
    expect(project.settings).toEqual({
      d: 100,
      hole: 10,
      bleed: 1,
      dpi: 300,
      maskMode: "upload",
      margin: 4,
      band: 20,
      curve: 12,
      guides: false,
      zones: true,
      pla: "#f4f2ec",
      bg: "#8a8a8a",
      name: "my-disc",
    });
    expect(project.mask).toBe("data:image/png;base64,TUFTSw==");
    expect(Object.keys(project.images)).toEqual(["i1", "i4"]);
    expect(project.layers).toHaveLength(2);
    expect(project.layers[0]).toMatchObject({ id: 2, type: "image", img: "i1", w: 120, rot: 15 });
    expect(project.layers[1]).toMatchObject({ id: 3, type: "text", flip: true, size: 6 });
  });

  it("keeps the eraser strokes of a layer", () => {
    const text = parseProject(HTML_V1_FILE).layers[1];
    expect(text?.erase).toEqual([
      {
        mode: "erase",
        r: 0.05,
        soft: 0.5,
        pts: [
          [0.1, 0.2],
          [0.15, 0.25],
        ],
      },
    ]);
  });

  it("throws on a file from another app", () => {
    const other = JSON.stringify({ app: "something-else", v: 1, layers: [] });
    expect(() => parseProject(other)).toThrow("Not a Disc Studio project.");
  });

  it("throws on a .nerd file of another tool", () => {
    const voucher = JSON.stringify({ tool: "voucher", version: 1 });
    expect(() => parseProject(voucher)).toThrow("Not a Disc Studio project.");
  });

  it("throws on JSON with no app and no tool", () => {
    expect(() => parseProject("{}")).toThrow("Not a Disc Studio project.");
    expect(() => parseProject("[]")).toThrow("Not a Disc Studio project.");
  });

  it("throws a plain message on text that is not JSON", () => {
    expect(() => parseProject("not json")).toThrow("not valid JSON");
  });

  it("falls back to the default settings when S is missing", () => {
    const project = parseProject(JSON.stringify({ app: "disc-studio", v: 1, layers: [] }));
    expect(project.settings).toEqual({
      d: 120,
      hole: 15,
      bleed: 1,
      dpi: 300,
      maskMode: "builtin",
      margin: 4,
      band: 20,
      curve: 12,
      guides: true,
      zones: true,
      pla: "#f4f2ec",
      bg: "#8a8a8a",
      name: "disc-design",
    });
    expect(project.mask).toBeNull();
    expect(project.images).toEqual({});
  });

  it("fills only the missing settings with defaults", () => {
    const file = JSON.stringify({
      app: "disc-studio",
      v: 1,
      S: { d: 90, name: "small" },
      layers: [],
    });
    const { settings } = parseProject(file);
    expect(settings.d).toBe(90);
    expect(settings.name).toBe("small");
    expect(settings.hole).toBe(15);
    expect(settings.maskMode).toBe("builtin");
  });

  it("does not share the default settings between projects", () => {
    const first = parseProject(JSON.stringify({ app: "disc-studio", v: 1, layers: [] }));
    first.settings.d = 1;
    expect(DEFAULT_SETTINGS.d).toBe(120);
  });

  it("reads a .nerd file: tool and version, no app", () => {
    const file = JSON.stringify({ tool: "disc-studio", version: 1, S: { d: 80 }, layers: [] });
    expect(parseProject(file).settings.d).toBe(80);
  });

  it("throws on a version it does not know", () => {
    const file = JSON.stringify({ tool: "disc-studio", version: 2, layers: [] });
    expect(() => parseProject(file)).toThrow("newer version");
  });

  it("names the broken field when a layer is damaged", () => {
    const file = JSON.stringify({
      app: "disc-studio",
      v: 1,
      layers: [{ id: 1, type: "image", name: "x", img: "i1", y: 0, w: 5 }],
    });
    expect(() => parseProject(file)).toThrow("layers.0.x");
  });
});

describe("serializeProject", () => {
  const project = parseProject(HTML_V1_FILE);

  it("writes the .nerd wrapper and keeps the HTML's app and v", () => {
    const written = JSON.parse(serializeProject(project)) as Record<string, unknown>;
    expect(written.tool).toBe("disc-studio");
    expect(written.version).toBe(1);
    expect(written.app).toBe("disc-studio");
    expect(written.v).toBe(1);
    expect(written.S).toEqual(project.settings);
  });

  it("round-trips: parse after serialize gives the same project", () => {
    expect(parseProject(serializeProject(project))).toEqual(project);
  });
});

describe("nextLayerId", () => {
  it("is 1 for an empty project", () => {
    expect(nextLayerId([], [])).toBe(1);
  });

  it("is one past the highest layer id", () => {
    const layers = [{ id: 3 }, { id: 7 }];
    expect(nextLayerId(layers, [])).toBe(8);
  });

  it("is one past the highest image id, which is 'i' plus the number", () => {
    expect(nextLayerId([{ id: 3 }], ["i2", "i9"])).toBe(10);
  });

  it("ignores an image id that is not 'i' plus a number", () => {
    expect(nextLayerId([{ id: 4 }], ["icon"])).toBe(5);
  });

  it("reads the ids of a parsed project", () => {
    expect(nextLayerId(parseProject(HTML_V1_FILE).layers, ["i1", "i4"])).toBe(5);
  });
});
