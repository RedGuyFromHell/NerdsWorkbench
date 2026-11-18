// Renders every fixture through the original disc-studio.html and through the engine, in the same
// Edge, and demands identical pixels. There is no tolerance: a differing byte fails the test.
import { readFileSync } from "node:fs";
import { expect, test, type Browser } from "@playwright/test";
import type { CanvasPixels, Captured } from "./capture";
import { FIXTURE_NAMES } from "./fixtures";

const REFERENCE_PAGE = "/tests/disc-parity/reference/disc-studio.html";
const PORT_PAGE = "/tests/disc-parity/parity.html";
const FONT_URL_PREFIX = "../assets/fonts/";
const PAGE_READY_MS = 15_000;
const FONT_STYLESHEETS = ["src/styles/fonts.css", "src/styles/disc-fonts.css"];

// The original loads its fonts from Google. Both pages get our bundled files instead.
function bundledFontCss(origin: string): string {
  return FONT_STYLESHEETS.map((path) => readFileSync(path, "utf8"))
    .join("\n")
    .replaceAll(FONT_URL_PREFIX, `${origin}/src/assets/fonts/`);
}

async function renderFixture(
  browser: Browser,
  pagePath: string,
  entry: string,
  fixtureName: string,
): Promise<Captured> {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    const origin = test.info().project.use.baseURL ?? "";
    await context.route("https://fonts.googleapis.com/**", (route) =>
      route.fulfill({ contentType: "text/css", body: bundledFontCss(origin) }),
    );
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(pagePath);
    if (entry) await page.addScriptTag({ type: "module", url: entry });
    await page
      .waitForFunction(() => window.parity !== undefined, undefined, { timeout: PAGE_READY_MS })
      .catch(() => {
        throw new Error(`${pagePath} never became ready. Page errors: ${pageErrors.join(" | ")}`);
      });
    return await page.evaluate(
      (name) => window.parity?.render(name) as Promise<Captured>,
      fixtureName,
    );
  } finally {
    await context.close();
  }
}

function differingPixels(expected: CanvasPixels, actual: CanvasPixels): number {
  const expectedBytes = Buffer.from(expected.base64, "base64");
  const actualBytes = Buffer.from(actual.base64, "base64");
  let differing = 0;
  for (let offset = 0; offset < expectedBytes.length; offset += 4) {
    if (expectedBytes.compare(actualBytes, offset, offset + 4, offset, offset + 4) !== 0)
      differing++;
  }
  return differing;
}

// WHY: two blank canvases are equal too, so the print must show some ink before equality means anything.
function inkPixels(pixels: CanvasPixels): number {
  const bytes = Buffer.from(pixels.base64, "base64");
  let ink = 0;
  for (let offset = 3; offset < bytes.length; offset += 4) if (bytes[offset] !== 0) ink++;
  return ink;
}

for (const fixtureName of FIXTURE_NAMES) {
  test(fixtureName, async ({ browser }) => {
    const reference = await renderFixture(
      browser,
      REFERENCE_PAGE,
      "/tests/disc-parity/reference-entry.ts",
      fixtureName,
    );
    const port = await renderFixture(browser, PORT_PAGE, "", fixtureName);

    expect(inkPixels(reference.print), "the reference print has ink").toBeGreaterThan(0);
    for (const canvasName of ["print", "view"] as const) {
      const expected = reference[canvasName];
      const actual = port[canvasName];
      expect(actual.width, `${canvasName} width`).toBe(expected.width);
      expect(actual.height, `${canvasName} height`).toBe(expected.height);
      expect(differingPixels(expected, actual), `${canvasName}: pixels that differ`).toBe(0);
    }
  });
}
