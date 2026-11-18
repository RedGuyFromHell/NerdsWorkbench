// The port's side of the parity test: opens a fixture in the engine and hands back its pixels.
// Dev-only page (parity.html); the app build never includes it.
import "../../src/styles/fonts.css";
import "../../src/styles/disc-fonts.css";
import { DiscDocument } from "../../src/tools/disc-studio/engine/document";
import { parseProject } from "../../src/tools/disc-studio/engine/project";
import { captureCanvas, requireCanvas, type Captured } from "./capture";
import { FIXTURES } from "./fixtures";

const view = requireCanvas("view");

async function render(fixtureName: string): Promise<Captured> {
  const build = FIXTURES[fixtureName];
  if (!build) throw new Error(`No fixture named "${fixtureName}".`);
  const fixture = build();
  const discDocument = new DiscDocument(view);
  await discDocument.open(parseProject(fixture.projectText));
  const { selectedIndex, tool, hover, brushMm, withSelection } = fixture.view;
  discDocument.selected =
    selectedIndex === null ? null : (discDocument.layers[selectedIndex] ?? null);
  discDocument.tool = tool;
  discDocument.hover = hover;
  discDocument.brushMm = brushMm;
  discDocument.renderer.draw(withSelection);
  const viewPixels = captureCanvas(view);
  const printPixels = captureCanvas(discDocument.renderer.compose());
  return { print: printPixels, view: viewPixels };
}

window.parity = { render };
