// The port's side of the parity test: opens a fixture in the engine and hands back its pixels.
// Dev-only page (parity.html); the app build never includes it.
import "../../src/styles/fonts.css";
import "../../src/styles/disc-fonts.css";
import { DiscDocument } from "../../src/tools/disc-studio/engine/document";
import { parseProject, serializeProject } from "../../src/tools/disc-studio/engine/project";
import { captureCanvas, requireCanvas, type Captured } from "./capture";
import { FIXTURES } from "./fixtures";

const view = requireCanvas("view");

async function openFixture(fixtureName: string, canvas: HTMLCanvasElement): Promise<DiscDocument> {
  const build = FIXTURES[fixtureName];
  if (!build) throw new Error(`No fixture named "${fixtureName}".`);
  const fixture = build();
  const discDocument = new DiscDocument(canvas);
  await discDocument.open(parseProject(fixture.projectText));
  const { selectedIndex, tool, hover, brushMm, withSelection } = fixture.view;
  discDocument.selected =
    selectedIndex === null ? null : (discDocument.layers[selectedIndex] ?? null);
  discDocument.tool = tool;
  discDocument.hover = hover;
  discDocument.brushMm = brushMm;
  discDocument.renderer.draw(withSelection);
  return discDocument;
}

function capture(discDocument: DiscDocument): Captured {
  const viewPixels = captureCanvas(discDocument.view);
  const printPixels = captureCanvas(discDocument.renderer.compose());
  return { print: printPixels, view: viewPixels };
}

async function render(fixtureName: string): Promise<Captured> {
  return capture(await openFixture(fixtureName, view));
}

// Save and open as the Save project and Open project buttons do (minus the file dialogs).
async function roundTrip(fixtureName: string): Promise<{ original: Captured; reopened: Captured }> {
  const original = await openFixture(fixtureName, view);
  const text = serializeProject(original.toProject());
  const reopenedDocument = new DiscDocument(document.createElement("canvas"));
  await reopenedDocument.open(parseProject(text));
  reopenedDocument.renderer.draw(false);
  original.renderer.draw(false);
  return { original: capture(original), reopened: capture(reopenedDocument) };
}

window.parity = { render, roundTrip };
