// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { prepareSvg, svgPixelSize } from "./svg";

const DATA_URL_PREFIX = "data:image/svg+xml;charset=utf-8,";

// Reads the prepared data URL back into an <svg> element, the way a browser would.
function prepared(text: string): Element {
  const url = prepareSvg(text);
  expect(url.startsWith(DATA_URL_PREFIX)).toBe(true);
  const xml = decodeURIComponent(url.slice(DATA_URL_PREFIX.length));
  return new DOMParser().parseFromString(xml, "image/svg+xml").documentElement;
}

const svgWith = (attributes: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attributes}><rect width="1" height="1"/></svg>`;

describe("svgPixelSize", () => {
  it("sets the long side to 4096 for a wide box", () => {
    expect(svgPixelSize(200, 100)).toEqual({ width: 4096, height: 2048 });
  });

  it("sets the long side to 4096 for a tall box", () => {
    expect(svgPixelSize(50, 100)).toEqual({ width: 2048, height: 4096 });
  });

  it("keeps the ratio, rounded", () => {
    expect(svgPixelSize(300, 100)).toEqual({ width: 4096, height: 1365 });
  });

  it("treats a square as wide", () => {
    expect(svgPixelSize(10, 10)).toEqual({ width: 4096, height: 4096 });
  });
});

describe("prepareSvg", () => {
  it("adds a viewBox from width and height", () => {
    const root = prepared(svgWith('width="200" height="100"'));
    expect(root.getAttribute("viewBox")).toBe("0 0 200 100");
    expect(root.getAttribute("width")).toBe("4096");
    expect(root.getAttribute("height")).toBe("2048");
  });

  it("falls back to 1000 x 1000 with no viewBox and no size", () => {
    const root = prepared(svgWith(""));
    expect(root.getAttribute("viewBox")).toBe("0 0 1000 1000");
    expect(root.getAttribute("width")).toBe("4096");
    expect(root.getAttribute("height")).toBe("4096");
  });

  it("falls back to 1000 x 1000 when only one of width and height is given", () => {
    expect(prepared(svgWith('width="200"')).getAttribute("viewBox")).toBe("0 0 1000 1000");
  });

  it("keeps an existing viewBox and sizes from it, tall", () => {
    const root = prepared(svgWith('viewBox="0 0 50 100" width="7" height="7"'));
    expect(root.getAttribute("viewBox")).toBe("0 0 50 100");
    expect(root.getAttribute("width")).toBe("2048");
    expect(root.getAttribute("height")).toBe("4096");
  });

  it("reads a viewBox separated by commas", () => {
    const root = prepared(svgWith('viewBox="0,0,300,100"'));
    expect(root.getAttribute("width")).toBe("4096");
    expect(root.getAttribute("height")).toBe("1365");
  });

  it("keeps the drawing", () => {
    expect(prepared(svgWith('width="2" height="2"')).querySelector("rect")).not.toBeNull();
  });

  it("throws when the root is not an svg", () => {
    expect(() => prepareSvg("<html><body/></html>")).toThrow("This SVG file cannot be read.");
    expect(() => prepareSvg("<div/>")).toThrow("This SVG file cannot be read.");
  });
});
