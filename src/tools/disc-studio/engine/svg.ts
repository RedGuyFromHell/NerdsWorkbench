// Prepares an SVG for use as an image layer: a viewBox and a big pixel size, so it is drawn sharp
// at any print size. Mirrors prepareSvg in disc-studio.html (lines 416-429); the parity test in
// tests/disc-parity is the final judge. Needs a DOM (DOMParser, XMLSerializer): the webview has one, the test uses happy-dom.

const SVG_LONG_SIDE_PX = 4096;
const FALLBACK_SIZE = 1000; // used when the file gives neither a viewBox nor a width and height
const DATA_URL_PREFIX = "data:image/svg+xml;charset=utf-8,";

/** The pixel size for a viewBox: the long side is 4096, the ratio is kept. */
export function svgPixelSize(
  viewBoxWidth: number,
  viewBoxHeight: number,
): { width: number; height: number } {
  return viewBoxWidth >= viewBoxHeight
    ? {
        width: SVG_LONG_SIDE_PX,
        height: Math.round((SVG_LONG_SIDE_PX * viewBoxHeight) / viewBoxWidth),
      }
    : {
        width: Math.round((SVG_LONG_SIDE_PX * viewBoxWidth) / viewBoxHeight),
        height: SVG_LONG_SIDE_PX,
      };
}

/** The SVG text as a data URL, with a viewBox and a pixel size. Throws when it is not an SVG. */
export function prepareSvg(text: string): string {
  const root = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
  if (root.nodeName.toLowerCase() !== "svg") throw new Error("This SVG file cannot be read.");
  let width = parseFloat(root.getAttribute("width") ?? "");
  let height = parseFloat(root.getAttribute("height") ?? "");
  if (!root.getAttribute("viewBox")) {
    if (!(width > 0 && height > 0)) width = height = FALLBACK_SIZE;
    root.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
  const viewBox = (root.getAttribute("viewBox") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const size = svgPixelSize(viewBox[2] ?? NaN, viewBox[3] ?? NaN);
  root.setAttribute("width", String(size.width));
  root.setAttribute("height", String(size.height));
  return DATA_URL_PREFIX + encodeURIComponent(new XMLSerializer().serializeToString(root));
}
