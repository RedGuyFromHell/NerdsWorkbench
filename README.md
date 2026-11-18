# Nerd's Workbench

A Windows desktop app with the small tools Nerd Castle uses. It is built on Tauri 2 with React and TypeScript (Vite). It replaces the old PyQt app, which lives on in the `NerdsWorkbench-legacy` repo.

The home screen shows one tile per tool. Planned tools:

- **Disc Studio**: a port of `disc-studio.html`.
- **Voucher Generator**: the voucher tab of the old app, same features.

Right now both tools are placeholders: the shell, the tool registry and the gate are in place.

## Development setup

You need, on Windows:

- Node 24 (npm comes with it) and WebView2 (already part of Windows 11).
- The MSVC Build Tools and Rust (stable-msvc), with clippy and rustfmt.
- gitleaks, for the secret scan in the gate.

Install the Rust side in PowerShell (the Build Tools step shows a UAC prompt; open a new terminal after both):

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
winget install --id Rustlang.Rustup -e
```

Then, in a new terminal:

```powershell
rustup default stable-msvc
rustup component add clippy rustfmt
corepack pnpm install
corepack pnpm tauri info
```

`tauri info` should list Rust, the MSVC toolchain and WebView2 with no red line. pnpm runs through `corepack`, pinned by `packageManager` in `package.json`.

Run the app:

```powershell
corepack pnpm tauri dev
```

The first run compiles Tauri from scratch and takes several minutes. Later runs are incremental. `corepack pnpm dev` alone serves the UI at http://localhost:1420 in a plain browser.

## The gate

`node tools/check.mjs` runs every check: Prettier, ESLint, rustfmt, gitleaks, `tsc`, Vitest, the Vite build, clippy, the Rust tests and the Disc Studio parity test. `--fast` runs the quick ones (this is what the pre-commit hook runs) and `--only <name>` runs one. The steps are listed in `check.config.json`. Never commit with `--no-verify`.

## Layout

- `src/app/`: the shell (title bar, home grid, status bar, tool view).
- `src/ui/`: the shared retro pieces (window, button, fields, dialog, progress bar). A tool builds its screen from these.
- `src/styles/`: the design tokens, base rules and the bundled fonts.
- `src/tools/`: one folder per tool, plus `registry.ts`, the list of tools. Adding a tool is a folder and one line in `TOOLS`.
- `src/lib/`: helpers shared by the shell and the tools.
- `src-tauri/`: the Rust side and the Tauri config.
- `docs/`: the plan (`plan-workbench-1.0.md`) and the learning notes (`learning-tauri.md`).

## Disc Studio

Disc Studio designs a printable disc (a coaster or a badge): images and text on layers, a mask, an eraser, and a print PNG with the dpi written in. It is a port of `disc-studio.html`. Its code is in `src/tools/disc-studio/`: the pure logic and the drawing in `engine/` (`geometry.ts`, `maskAlpha.ts`, `pngDpi.ts`, `project.ts` for the file format read with zod, `svg.ts`, `layerOps.ts`, `addLayer.ts` for what a new layer starts with, `pointer.ts` for the mouse and the key listener, `keys.ts` for what each key means), each with a Vitest test beside it, then `document.ts` (the open document, with `subscribe` and `getVersion` for React), `render.ts` (the drawing) `actions.ts`, `toolActions.ts` and `fileActions.ts` (what the screen does to the document: layers and settings, the tools and keys, the file dialogs), and the screen in `DiscStudio.tsx` with its `panels/`.

### Using the screen

Three columns under the pink tool bar.

- **Left, settings.** _Disc (mm)_: diameter, hole, bleed and DPI. _Mask_: the type (the built-in mask, an uploaded one, or none, which prints on the whole disc) and, for the built-in one, its margin, the band at the bottom and the band's curve; _Upload mask…_ opens an image (transparent = no ink, or white = art and dark or grey = no ink; it is stretched to the full square) and switches the type to _Uploaded_. _View_: guides (cut and safe lines), the red tint on the no-ink zones, the PLA colour and the background colour. A disc or mask change rebuilds the masks; the view options only redraw. _Project_ at the bottom: _Save project_ and _Open project_.
- **Middle, the disc.** The canvas shows the print as it will come out, on bare PLA. Drag a layer to move it. The wheel over the canvas resizes the selected layer (an image's width, a text's size) by 3% a step; hold Alt for 0.5% steps. Shift + wheel turns it by 1 degree a step, Alt + Shift by 0.1.
- **Right, layers.** _Add text_ adds a text layer in the middle of the mask's band. To add an image, press _Add image_ (the Windows file dialog; several files at once work) or drop PNG, JPG or SVG files on the window (a drop highlights the canvas area). The first layer is clipped to the mask, later ones to the whole disc. _Layers_ lists the layers top first: the box shows or hides one, the name selects it, the arrows move it up or down, and the red cross deletes it. Below it, the properties of the selected layer: for text its words, font, size, spacing, colour, outline, bold and italic; for an image its width, _Cover disc_ and _Fit in disc_, and _Recolour_ (one colour, for logos); for both the position from the centre, rotation, opacity, what it is clipped to, mirror, _Centre_ and _Copy_.

- **Right, tool and export.** _Tool_: Move, Eraser and Restore, the brush size in mm and its softness (0 hard, 1 very soft). The eraser and restore brush paint on the selected layer only (with none selected, the first press selects the layer under it); the strokes are kept in the layer's own units, so they move, turn and scale with it, and _Clear eraser_ in the layer's properties removes them. With the eraser or restore tool the wheel changes the brush size. _Export_: the file name, _Export print PNG_ (transparent where there is no ink, no guides) and _Export preview_ (what the canvas shows, without the selection box). Both PNGs carry the DPI in a pHYs chunk, so print apps read the right size.

A picture that has fewer pixels than the print needs (below 95% of its width at the chosen DPI) shows a warning in the status bar. A file that cannot be read or opened shows a message window, not a browser alert; what worked shows in the status bar.

### Shortcuts

They work while Disc Studio is on screen and the focus is not in a field or a message window. Ctrl+Z and Ctrl+Y also work with a list, a checkbox or a colour picker focused; inside a text field they undo the typing there.

| Key                        | What it does                                          |
| -------------------------- | ----------------------------------------------------- |
| V, E, R                    | Move, Eraser and Restore tool                         |
| Ctrl+Z                     | Undo the last change (one step per act)               |
| Ctrl+Shift+Z, Ctrl+Y       | Redo                                                  |
| Arrow keys                 | Nudge the selected layer 0.1 mm (hold Shift for 1 mm) |
| Delete or Backspace        | Delete the selected layer                             |
| Ctrl+D                     | Copy the selected layer                               |
| Wheel over the disc        | Resize the layer (brush size with Eraser or Restore)  |
| Shift + wheel, Alt + wheel | Turn the layer; finer steps (see above)               |

### The parity test

`render.ts` must draw the same pixels as the original `disc-studio.html`. `tests/disc-parity/` proves it: for each fixture project (`fixtures.ts`, built on a canvas in the page) a Playwright test renders it through an unchanged copy of the original (`reference/disc-studio.html`) and through the engine (`parity.html`), then compares the print and the view canvas byte for byte. There is no tolerance. Run it with:

```powershell
corepack pnpm exec playwright test
```

It starts its own Vite server on port 1421 (the app's 1420 stays free) and needs Microsoft Edge, which Windows has. The test uses Edge (`channel: "msedge"`) and downloads no browser, because the app's webview, WebView2, is Edge's Chromium: the same engine draws the same pixels. The original loads its fonts from Google, so the test serves it our bundled files (`src/styles/disc-fonts.css`) instead; both pages use the same font files. A failing fixture reports how many pixels differ. The gate runs this as the `disc-parity` step. The same file also has a save-and-reopen test: a few fixtures are written to project text as _Save project_ does, opened in a second document as _Open project_ does, and both canvases must match byte for byte.

## The look

Retro tech: cream window bodies, thick black outlines, hard offset shadows (never a blur), mono labels, chunky buttons. The shell bar on top is Nerd Castle royal purple. Each tool gets a pastel bar in its own colour (`colour` in its registry entry), and the home screen is a grid of yellow folder tiles.

- **Every colour is a token** in `src/styles/tokens.css`. Nothing else holds a raw colour, so a dark mode later only redefines those names. The shell bar uses `--brand-purple` and `--on-brand` (from `DESIGN.md`: parchment on royal purple is 11.2:1). Never put red text on the purple; red may only be a fill.
- **Shared pieces** live in `src/ui/`; their styles are in `src/ui/retro.css`.
- **Fonts are bundled** in `src/assets/fonts/` as woff2, with their licences (both SIL OFL): IBM Plex Mono for labels and titles, Inter for fields. They load with no network. To add a weight, copy the woff2 there and add a `@font-face` block in `src/styles/fonts.css`.
- The window has no OS frame (`decorations: false`). The title bar drags, minimises, maximises and closes it. There is no Windows snap-layout flyout on the maximise button: that is accepted.

## Project files

A project file is JSON with a top-level `"tool"` field and a `"version"` field, and the extension `.nerd`. The app opens it in the tool named by `"tool"`, not by the extension. Old Disc Studio files end in `.disc.json` and open in Disc Studio by their extension.

Disc Studio's _Save project_ writes `<file name>.nerd`: `"tool": "disc-studio"`, `"version": 1`, the settings (`S`), the uploaded mask, every image as a data URL and the layers with their eraser strokes. It also writes the old `"app"` and `"v"` fields, so the original `disc-studio.html` still opens the file if you rename it to `.json`. _Open project_ takes `.nerd` and `.disc.json` files; a file of another tool, or from a newer version, shows a message and changes nothing.

### Opening a file from Explorer

The installer registers `.nerd` for the current user, so a double-click opens the file in Nerd's Workbench. The app routes it by the `"tool"` field inside the file (a `.nerd` file of an unknown tool, or one that is not valid JSON, shows a message window). Old `.disc.json` files are not registered (Explorer sees them as `.json`); they open from Disc Studio's _Open project_ button or by the extension when passed to the app.

Only one copy of the app runs. If it is already open, a second launch (the double-click) does not start a second window: the running window comes to the front and opens the file. Rust queues the paths (`src-tauri/src/open_files.rs`) and the page takes them (`src/app/openFiles.ts`); the decision of which tool gets a file is in `src/app/routeOpenFile.ts`, with tests.

The page reads and writes files through two Rust commands (`read_file_bytes`, `write_file_bytes` in `src-tauri/src/files.rs`) that carry the bytes as a raw request body, with the paths coming from the Windows dialogs. In a plain browser (the Vite URL) the file buttons show "Files can only be opened and saved in the desktop app."
