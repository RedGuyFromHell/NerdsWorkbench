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

Disc Studio designs a printable disc (a coaster or a badge): images and text on layers, a mask, an eraser, and a print PNG with the dpi written in. It is a port of `disc-studio.html`. Its pure logic is already here, in `src/tools/disc-studio/engine/`: `geometry.ts` (disc and layer maths), `maskAlpha.ts`, `pngDpi.ts`, `project.ts` (the file format, read with zod), `svg.ts` and `layerOps.ts`, each with a Vitest test beside it. `document.ts` holds the open document (settings, layers, images, mask, `subscribe` and `getVersion` for React) and `render.ts` draws it. The screen comes in the next slices.

### The parity test

`render.ts` must draw the same pixels as the original `disc-studio.html`. `tests/disc-parity/` proves it: for each fixture project (`fixtures.ts`, built on a canvas in the page) a Playwright test renders it through an unchanged copy of the original (`reference/disc-studio.html`) and through the engine (`parity.html`), then compares the print and the view canvas byte for byte. There is no tolerance. Run it with:

```powershell
corepack pnpm exec playwright test
```

It starts its own Vite server on port 1421 (the app's 1420 stays free) and needs Microsoft Edge, which Windows has. The test uses Edge (`channel: "msedge"`) and downloads no browser, because the app's webview, WebView2, is Edge's Chromium: the same engine draws the same pixels. The original loads its fonts from Google, so the test serves it our bundled files (`src/styles/disc-fonts.css`) instead; both pages use the same font files. A failing fixture reports how many pixels differ. The gate runs this as the `disc-parity` step.

## The look

Retro tech: cream window bodies, thick black outlines, hard offset shadows (never a blur), mono labels, chunky buttons. The shell bar on top is Nerd Castle royal purple. Each tool gets a pastel bar in its own colour (`colour` in its registry entry), and the home screen is a grid of yellow folder tiles.

- **Every colour is a token** in `src/styles/tokens.css`. Nothing else holds a raw colour, so a dark mode later only redefines those names. The shell bar uses `--brand-purple` and `--on-brand` (from `DESIGN.md`: parchment on royal purple is 11.2:1). Never put red text on the purple; red may only be a fill.
- **Shared pieces** live in `src/ui/`; their styles are in `src/ui/retro.css`.
- **Fonts are bundled** in `src/assets/fonts/` as woff2, with their licences (both SIL OFL): IBM Plex Mono for labels and titles, Inter for fields. They load with no network. To add a weight, copy the woff2 there and add a `@font-face` block in `src/styles/fonts.css`.
- The window has no OS frame (`decorations: false`). The title bar drags, minimises, maximises and closes it. There is no Windows snap-layout flyout on the maximise button: that is accepted.

## Project files

A project file is JSON with a top-level `"tool"` field and a `"version"` field, and the extension `.nerd`. The app opens it in the tool named by `"tool"`, not by the extension. Old Disc Studio files end in `.disc.json` and open in Disc Studio by their extension.
