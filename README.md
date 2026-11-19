# Nerd's Workbench

A Windows desktop app with the small tools Nerd Castle uses, built on Tauri 2 with React and TypeScript (Vite). This is version 1.0: it replaces the old PyQt app, which lives on in the `NerdsWorkbench-legacy` repo and is no longer needed (see "Retire the old app" in `docs/releasing.md`).

The home screen shows one tile per tool:

- **Disc Studio**: designs a printable disc (a coaster or a badge) and exports the print PNG.
- **Voucher Generator**: makes a batch of unique discount codes, creates the discount in Shopify and writes one voucher image per code.
- **Payout**: works out, once a month, what each printer and painter is owed.

## Install and update

Download the newest setup `.exe` from this repo's Releases page and run it. The installer is per user: it needs no admin rights. Windows SmartScreen may warn about an unknown publisher; choose _More info_, then _Run anyway_.

The app looks for a newer release on every start and offers it in a prompt; _Update now_ downloads it, installs it and restarts the app. Settings (the gear at the left of the status bar) shows the installed version.

## Releasing

A release is a tag `vX.Y.Z` pushed to GitHub, with the same version in `package.json`. The steps, what the installer registers and how to retire the old PyQt app are in `docs/releasing.md`.

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

### Unsaved work

Disc Studio counts as having unsaved work from the first change after a save or an open until the next Save project (Export PNG does not count as a save; undoing back to the saved state clears it). Every way out of a tool with unsaved work asks first, in a message window with _Save_, _Don't save_ and _Cancel_: Escape, the mouse Back and Forward buttons, the _< HOME_ button, closing the window (the X button, Alt+F4 or the taskbar) and _Update now_. _Cancel_, a cancelled Save dialog and a failed save keep you where you are. _Don't save_ only leaves: going home keeps the work in the tool until the window closes, and Back (or the tile) brings you back to it. _Open project_ (and a `.nerd` file opened from Explorer) asks the same way before it replaces unsaved work: _Save_ writes the file and then opens, _Don't save_ opens, _Cancel_ keeps the design. Windows shutdown and log-off cannot ask. A new tool takes part by calling `setUnsavedWork` from its `ToolContext` (`src/tools/types.ts`).

### The parity test

`render.ts` must draw the same pixels as the original `disc-studio.html`. `tests/disc-parity/` proves it: for each fixture project (`fixtures.ts`, built on a canvas in the page) a Playwright test renders it through an unchanged copy of the original (`reference/disc-studio.html`) and through the engine (`parity.html`), then compares the print and the view canvas byte for byte. There is no tolerance. Run it with:

```powershell
corepack pnpm exec playwright test
```

It starts its own Vite server on port 1421 (the app's 1420 stays free) and needs Microsoft Edge, which Windows has. The test uses Edge (`channel: "msedge"`) and downloads no browser, because the app's webview, WebView2, is Edge's Chromium: the same engine draws the same pixels. The original loads its fonts from Google, so the test serves it our bundled files (`src/styles/disc-fonts.css`) instead; both pages use the same font files. A failing fixture reports how many pixels differ. The gate runs this as the `disc-parity` step. The same file also has a save-and-reopen test: a few fixtures are written to project text as _Save project_ does, opened in a second document as _Open project_ does, and both canvases must match byte for byte.

## Payout

Payout works out, once a month, what each printer and painter is owed for the resin miniatures sold, and locks the month. It only ever reads the shop (Shopify); it writes nothing there. The rules and the maths are in `docs/spec-payout-tool.md`, the build plan in `docs/plan-payout-tool.md`. The code is in `src/tools/payout/`: the pure maths and the statements in `core/`, the stored files in `storage/`, the screens beside them. Loading a month from Shopify is a later slice; until then a dev build can show made-up demo data.

- **Where the data lives.** In the app data folder, under `payout/`: `settings.json`, `people.json`, `choices.json`, `paid-marks.json` and one file per month in `months/`. A closed month's file is written once and never changed again; the paid marks have their own file.
- **Statements.** A closed month has, for each person, a PDF (one A4 page, English) and a CSV of the same lines, saved where you pick. An open month has neither, because its totals can still change. The statement says what is owed, the parts, the lines, a paragraph on the rules written from the rates locked in that month, a "Paid on" line and a statement id (`PAY-<month>-<first 6 letters of the person id>`, the same on every export). The CSV has a header row, a comma between cells, a dot as the decimal mark, and UTF-8 with a byte order mark so Excel reads `ș` and `ț`.
- **The PDF library.** [`pdfmake`](https://pdfmake.org) (MIT), version 0.3.14, pinned exactly, with `@types/pdfmake` for its types (17 packages in all: `pdfkit`, `fontkit`, `linebreak`, `xmldoc` and their small helpers). It is loaded only when a statement is saved, as two separate chunks (the library, about 770 kB, and its bundled Roboto font, about 850 kB), so the start of the app does not grow. Roboto has the Romanian letters `ș` and `ț`. pdfmake builds the PDF in the page without `eval` or a worker, so the app's Content Security Policy (`default-src 'self'`, no `unsafe-eval`) is left as it is.

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

## Shopify connection

The Shopify connection belongs to the whole app, not to one tool. It is set up once in the Settings window (the gear at the left of the status bar), section _Shopify connection_. A tool that needs Shopify shows "Not connected - open Settings" until then; the other tools work without it.

### Setting it up

The app connects through a Shopify app of your own, made in the Shopify Dev Dashboard (not an App Store app):

1. In the Dev Dashboard, create an app (or open the existing one) and make a version with:
   - redirect URL `http://localhost:8765/callback`, exactly like that (not `127.0.0.1`, no trailing slash);
   - scopes `read_price_rules`, `write_price_rules`, `read_discounts`, `write_discounts`, `read_products`, `read_orders`.
2. Install the app on the store.
3. In Nerd's Workbench, open Settings and fill in the store (`your-store.myshopify.com`), the app's client ID and its client secret.
4. Press _Connect to Shopify_. The browser opens Shopify's approval page; approve within two minutes. The browser tab then says "Approved" and the Settings window says "Connected".

If port 8765 is taken by another program, Connect says so: close that program and connect again. The port is only open while a connect is waiting, on this PC only (`127.0.0.1` and `::1`), no other program can share it, and it closes after the first answer that belongs to this connect. Any other request gets a 404.

### Where the secrets live

- The **access token** and the **client secret** are in Windows Credential Manager (_Windows Credentials_, generic credentials `shopify-token.nerds-workbench` and `shopify-client-secret.nerds-workbench`). They are never written to a file.
- The store name, the client ID and the API version (`2026-04` by default) are in `settings.json` in the app's config folder (`%APPDATA%\eu.nerdcastle.workbench\`). Nothing secret is in that file.
- The page (the web view) never gets the token or the secret. It can ask whether they exist, send a new client secret, and send a GraphQL query; Rust adds the token and returns the data (`src-tauri/src/shopify/`, called from `src/lib/shopify/client.ts`). An error shows the HTTP status and Shopify's own message, never a secret.

### Coming from the old app

The old PyQt app kept all of this, token and secret included, as plain text in `~/.nerdworkbench/config.json`. The first start of this app imports it: the token and the secret go to Windows Credential Manager, then the old file is rewritten without those two keys, then `settings.json` is written. If Credential Manager refuses, the old file is left untouched and the next start tries again. The Settings window says when the import happened, or why it failed.

Every later start looks again. If the old file holds a token or a secret once more (the old app ran, or a sync or a backup put the file back), they are taken out again. What the app already holds in Credential Manager is kept, and an old token is only stored when the old file names the same store as Settings.

After the import, if the old file was ever synced (OneDrive, Dropbox) or backed up, its copies still hold the client secret as plain text. Rotate the client secret in the Dev Dashboard, enter the new one in Settings and connect again.

### Disconnecting

_Disconnect_ in the Settings window removes both entries from Windows Credential Manager (you can check there). The app stays installed on the store: to revoke the token itself, uninstall the app in the Shopify admin. Changing the store name in Settings also removes the token, because a token only works on the store that issued it.

## Voucher Generator

Makes a batch of unique discount codes, creates the matching discount in Shopify, and renders one voucher image per code. The decisions (code generation, text layout, the code-area selection, the discount input, the code batches) are plain functions in `src/tools/voucher/core/` and `src/tools/voucher/shopify/`, each with a test beside it.

### Using the screen

The preview is on the left, the settings on the right. Under the GENERATE! button a line says what is still missing, or what a run will create.

1. **Choose Voucher** (or drop an image on the screen): a jpg, png or webp template. It is shown at the largest size that fits, and every number below is in the template's own pixels.
2. **Draw the code area** on the preview: press and drag. Drag the area to move it, drag a round corner handle to resize it. An area under 8 pixels on a side is dropped when you let go.
3. The code is drawn live inside the area, centred, with the font, size, letter spacing, colour and outline of section 01. What you see is what the exported image will hold: the preview and the export use the same drawing function (`core/drawVoucher.ts`). The sample code keeps its random letters until the prefix, the length or "Numbers only" change.
4. **02 Discount** and **03 Code** hold the settings of the old app with the same defaults (10 %, usage 1, once per customer, today to today + 30 days, `SUMMER-`, 100 vouchers, 8 characters). Without a Shopify connection section 02 shows "Not connected - open Settings"; the collection list loads once connected.
5. The status bar shows the code area as a percentage of the template and the sample code.

The font list is every font installed on the PC (read by Rust with `fontdb`, `src-tauri/src/fonts.rs`); the default is Impact, or the first font when the PC has none. Like the old app, the screen keeps nothing between runs and never asks about unsaved work.

GENERATE! stays off, with the reason, until there is a template, a code area, a save folder, a prefix and a Shopify connection. A discount set to "Specific Collections" with none picked is also blocked: the old app turned that into a discount on **every** product.

### What GENERATE! does

One press is one run, in this order (`core/generateRun.ts`, tested with stand-ins for Shopify and the disk):

1. It makes the codes and writes them to `codes.csv` in the save folder (a header line `code`, then one code per line). The file is written before anything is sent to Shopify, so the codes can never exist only there.
2. It creates **one** discount in Shopify, titled `Workbench — <prefix>`, with the first code. The start date begins at 00:00:00 UTC and the end date ends at 23:59:59 UTC, as in the old app.
3. It adds the other codes in batches of 250 and waits for Shopify to finish each batch (up to two minutes a batch) before it sends the next.
4. It writes one image per code to the save folder, named after the code: JPG at quality 0.95 for a jpg template, PNG for a png or webp one. A character Windows does not allow in a file name becomes `-` in the name; the code itself is unchanged.

While it runs, the button says GENERATING… and the line under it shows the step and the count; then DONE! for about two seconds. The voucher image cannot be changed during a run. A run overwrites a `codes.csv` and images of the same names already in the folder: use a fresh folder for each batch.

If something fails, a message window says what exists:

- **Before the discount was created:** "Nothing was created in Shopify." If `codes.csv` was already written, its codes do not exist in Shopify: delete the file.
- **After the discount was created:** the message names the discount, how many of the codes are in Shopify (or how many images were written) and the path of `codes.csv`. Delete that discount in the Shopify admin (Discounts) before generating again: a second run makes new codes and a second discount, it does not finish the first.

Closing the window during a run stops it before the next image. If the run had reached the images, the discount and `codes.csv` are complete; if it had not, check the discount in the Shopify admin.

Two Shopify pitfalls from the old app:

- **`DiscountCodeBasicInput` has no `codes` array.** The first code goes in the singular `code` field when the discount is created; every other code is added afterwards with `discountRedeemCodeBulkAdd`, in batches of at most 250.
- **`discountRedeemCodeBulkAdd` only queues the codes.** Shopify creates them in the background and the mutation returns a `bulkCreation { id }`. An inline fragment `... on DiscountCodeBulkCreation` on a `node(id)` query fails (there is no such type); ask the root query `discountRedeemCodeBulkCreation(id:)` for `done`, `importedCount` and `failedCount` instead. The old app did not look, so a refused code went unnoticed.
