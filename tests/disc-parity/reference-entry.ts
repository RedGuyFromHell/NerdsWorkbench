// The original's side of the parity test: drives disc-studio.html through its own globals.
// Loaded as a module after the page's classic script, so those globals are in reach.
import { captureCanvas, requireCanvas, type Captured } from "./capture";
import { FIXTURES } from "./fixtures";

declare function openProject(file: File): Promise<void>;
declare const DS: {
  draw(withSelection?: boolean): void;
  compose(): HTMLCanvasElement;
  layers: unknown[];
};
// The page's own state, declared with `let` in its script.
declare let sel: unknown;
declare let tool: string;
declare let hover: [number, number] | null;
declare let brush: number;

const view = requireCanvas("view");

async function render(fixtureName: string): Promise<Captured> {
  const build = FIXTURES[fixtureName];
  if (!build) throw new Error(`No fixture named "${fixtureName}".`);
  const fixture = build();
  await openProject(new File([fixture.projectText], "fixture.disc.json"));
  const { selectedIndex, tool: toolName, hover: hoverMm, brushMm, withSelection } = fixture.view;
  sel = selectedIndex === null ? null : (DS.layers[selectedIndex] ?? null);
  tool = toolName;
  hover = hoverMm;
  brush = brushMm;
  DS.draw(withSelection);
  const viewPixels = captureCanvas(view);
  const printPixels = captureCanvas(DS.compose());
  return { print: printPixels, view: viewPixels };
}

window.parity = { render };
