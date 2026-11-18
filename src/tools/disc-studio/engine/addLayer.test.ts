import { describe, expect, it } from "vitest";
import {
  isImageFile,
  isSvgFile,
  layerNameFromFile,
  lowDpiWarning,
  newImageLayer,
  newTextLayer,
  textLayerName,
} from "./addLayer";
import { DEFAULT_SETTINGS } from "./project";

describe("newTextLayer", () => {
  it("sits in the middle of the band of a built-in mask that has one", () => {
    // d 120, band 20: the band's middle is 50 mm below the centre.
    const layer = newTextLayer(3, { ...DEFAULT_SETTINGS, d: 120, band: 20, maskMode: "builtin" });
    expect(layer).toMatchObject({
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
      flip: false,
      visible: true,
    });
  });

  it("sits at the centre with no band or with another mask type", () => {
    expect(newTextLayer(1, { ...DEFAULT_SETTINGS, band: 0 }).y).toBe(0);
    expect(newTextLayer(1, { ...DEFAULT_SETTINGS, maskMode: "none" }).y).toBe(0);
  });
});

describe("newImageLayer", () => {
  const settings = { ...DEFAULT_SETTINGS, d: 120 };

  it("covers the disc's width for a wide image, keeping the ratio", () => {
    const layer = newImageLayer({
      id: 2,
      imageId: "i1",
      name: "wide",
      natural: { width: 200, height: 100 },
      settings,
      hasLayers: false,
    });
    expect(layer.w).toBe(240);
  });

  it("fills the disc's width for a tall image", () => {
    const layer = newImageLayer({
      id: 2,
      imageId: "i1",
      name: "tall",
      natural: { width: 100, height: 200 },
      settings,
      hasLayers: false,
    });
    expect(layer.w).toBe(120);
  });

  it("clips the first layer to the mask and later ones to the disc", () => {
    const base = {
      id: 2,
      imageId: "i1",
      name: "logo",
      natural: { width: 100, height: 100 },
      settings,
    };
    expect(newImageLayer({ ...base, hasLayers: false }).clip).toBe("mask");
    expect(newImageLayer({ ...base, hasLayers: true }).clip).toBe("disc");
  });

  it("starts centred, upright, fully opaque and visible", () => {
    const layer = newImageLayer({
      id: 7,
      imageId: "i6",
      name: "logo",
      natural: { width: 100, height: 100 },
      settings,
      hasLayers: false,
    });
    expect(layer).toMatchObject({
      id: 7,
      type: "image",
      img: "i6",
      name: "logo",
      x: 0,
      y: 0,
      rot: 0,
      opacity: 1,
      flip: false,
      visible: true,
    });
  });
});

describe("textLayerName", () => {
  it("is the first line, at most 30 characters", () => {
    expect(textLayerName("Hello\nWorld")).toBe("Hello");
    expect(textLayerName("x".repeat(40))).toBe("x".repeat(30));
  });

  it("is Text when the first line is empty", () => {
    expect(textLayerName("")).toBe("Text");
    expect(textLayerName("\nabc")).toBe("Text");
  });
});

describe("lowDpiWarning", () => {
  // 120 mm at 300 dpi needs 1417.3 px; the warning starts below 95% of that, 1346.4 px.
  const base = { name: "logo", widthMm: 120, dpi: 300, vector: false };

  it("says how many pixels the image has and needs", () => {
    expect(lowDpiWarning({ ...base, naturalWidth: 1000 })).toBe(
      "logo: 1000px wide, needs 1417px for 300 dpi.",
    );
  });

  it("is quiet from 95% of the needed width up", () => {
    expect(lowDpiWarning({ ...base, naturalWidth: 1347 })).toBeNull();
    expect(lowDpiWarning({ ...base, naturalWidth: 1346 })).not.toBeNull();
  });

  it("is quiet for an SVG, which is drawn sharp at any size", () => {
    expect(lowDpiWarning({ ...base, naturalWidth: 10, vector: true })).toBeNull();
  });
});

describe("files", () => {
  it("knows an SVG by its type or by its extension", () => {
    expect(isSvgFile({ type: "image/svg+xml", name: "a" })).toBe(true);
    expect(isSvgFile({ type: "", name: "Logo.SVG" })).toBe(true);
    expect(isSvgFile({ type: "image/png", name: "logo.png" })).toBe(false);
  });

  it("takes any image type and SVG, and nothing else", () => {
    expect(isImageFile({ type: "image/jpeg", name: "a.jpg" })).toBe(true);
    expect(isImageFile({ type: "", name: "a.svg" })).toBe(true);
    expect(isImageFile({ type: "application/pdf", name: "a.pdf" })).toBe(false);
  });

  it("names a layer after the file without its last extension", () => {
    expect(layerNameFromFile("my.logo.png")).toBe("my.logo");
    expect(layerNameFromFile("plain")).toBe("plain");
  });
});
