# Plan: Nerd's Workbench 1.0 on Tauri 2

Plane: NERDC-148 (parent). Chunk 1 = NERDC-149, chunk 2 = NERDC-150, chunk 3 = NERDC-151.
Written 2026-11-18 by the planner. The main session (overseer) builds from it with one fresh coder per slice.

## Decisions on the planner's open questions (Andrei, 2026-11-18)

1. **Project files use `.nerd`, one extension for every Workbench tool.** `.disc.json` cannot be associated: Explorer sees it as `.json`. A `.nerd` file is JSON with a top-level `"tool"` field (for example `"tool": "disc-studio"`) and a `"version"` field. The app registers `.nerd` once. On open, it routes by the `tool` field, not by the extension. An unknown `tool` gives a clear error dialog. Disc Studio still opens old `.disc.json` files (no `tool` field) from its Open dialog and by drag and drop. Wherever this plan says `.nerd` routes to Disc Studio by extension, read: `.nerd` routes by its `tool` field; only `.disc.json` routes by extension.
2. **Repo switch: rename and recreate.** Rename the current repo to `NerdsWorkbench-legacy` (it stays private, with its PR and branches). Create a new public `NerdsWorkbench` and push the orphan `main`. Note: the main session already made a private `NerdsWorkbench-legacy` mirror on 2026-11-18. At cutover, check that the mirror matches the original, delete the mirror, then rename. Andrei approved this order.
3. **pnpm through corepack** (`corepack pnpm ...`), pinned by `packageManager` in `package.json`.
4. **Write `codes.csv`** to the save folder before the Shopify call (slice S3.4).

---

## 1. What we build

One Windows desktop app, Nerd's Workbench, on Tauri 2 + React + TypeScript (Vite). It replaces the PyQt app in this repo.

- A home screen with a grid of tool icons. Each tool opens in a retro window with its own title-bar colour.
- v1 tools: **Disc Studio** (port of `disc-studio.html`) and **Voucher Generator** (parity with PyQt v0.4.2). The three stub tabs are dropped.
- An NSIS installer, per user, no admin prompt. On start the app checks GitHub Releases and asks "Update now / Later".
- A `vX.Y.Z` tag builds and publishes a release through GitHub Actions.
- Versions: 0.5.0 (shell + updater), 0.6.0 (Disc Studio), 1.0.0 (voucher parity).

## 2. Decisions this plan takes (two lines each)

- **Shopify secrets stay in Rust.** OAuth, the token exchange and every GraphQL call run in Rust; the webview never holds the token or the client secret. The webview sends a query and variables to one command and gets data back.
- **Files go through two small Rust commands** (`read_file_bytes`, `write_file_bytes`), not `tauri-plugin-fs`. The fs plugin's path scopes break on paths the user picked in an earlier session or on `D:\`; the dialogs still come from `tauri-plugin-dialog`.
- **`dragDropEnabled: false` on the window.** Then a file dropped on the page arrives as an HTML5 `File`, exactly as in `disc-studio.html`. Tauri's own drop event (paths only) is not needed.
- **Disc Studio keeps its mutate-then-redraw model.** The engine is a plain TypeScript module with a small `subscribe`/`getVersion` store; React panels read it with `useSyncExternalStore`. No state library: pointer moves change layers dozens of times a second and the HTML does exactly this.
- **Pixel parity is proven against the original file, in the same browser engine.** A Playwright test (channel `msedge`, the same Chromium as WebView2, no browser download) renders fixture projects through `disc-studio.html` and through the port, and compares pixels exactly.
- **Fonts: IBM Plex Mono for labels and titles, Inter for fields.** Plex Mono has the weights and the Romanian `ș ț`; Inter is already in the prototype and is one of Disc Studio's text fonts, so one bundle serves both. Both come from `@fontsource` packages (OFL).
- **A custom title bar** (`decorations: false`) with drag region and min / max / close buttons. The retro look lives in the title bar; a native frame would sit above it.
- **Opened tools stay mounted.** Going back to the home grid hides a tool, it does not unmount it, so unsaved Disc Studio work survives.
- **`productName` is `Nerds Workbench`** (no apostrophe) for the exe, the install folder and the NSIS installer. The window title and the UI say "Nerd's Workbench". An apostrophe in a path is a known NSIS and shell-quoting trap.
- **The version lives in `package.json` only.** `tauri.conf.json` reads it (`"version": "../package.json"`); `Cargo.toml` keeps `0.0.0` with a `WHY:` comment.
- **The Shopify connection is app-wide** (Andrei, 2026-11-18, replacing "belongs to the Voucher tool"). It is set up in the gear Settings window, and its client lives in `src/lib/shopify/`, because more tools will use it later. Voucher-only Shopify logic (discount input, collections, code batches) stays in `src/tools/voucher/shopify/`. Other tools work with no Shopify set up, unlike today's blocking first-run dialog.

## 3. Prerequisites on Andrei's PC

Present: Node 24, npm 11, WebView2, gitleaks, gh, winget, Microsoft Edge. Missing: Rust and the MSVC Build Tools.

Run in PowerShell. The Build Tools step shows a UAC prompt; open a new terminal after both.

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
winget install --id Rustlang.Rustup -e
```

Then, in a new terminal:

```powershell
rustup default stable-msvc
rustup component add clippy rustfmt
rustc --version
cargo --version
corepack pnpm --version
```

After slice S1.1 lands, `corepack pnpm tauri info` must list Rust, the MSVC toolchain and WebView2 with no red line.
Maria's PC needs nothing: she installs the released installer.

## 4. Preparation by the main session, before S1.1

Each step changes git state or the KB, so a coder may not do it.

1. **KB:** `engineering/install-lib.mjs:20`, change the workbench entry from `stack: "python"` to `stack: "typescript"`. Commit in the KB.
2. **Workbench, in place:** `git switch --orphan main` (it empties the tracked tree; the old code stays on `master` and `chore/python-stack`).
3. Keep the old app runnable: if Andrei runs it from `app/dist/NerdsWorkbench/`, move that folder out of the repo first (for example to `D:\Apps\NerdsWorkbench-0.4.2\`). Then delete the leftovers: `app/`, `.venv/`, `.pytest_cache/`, `.ruff_cache/`, `tests/__pycache__/`.
4. `node D:\Projects\NERD-CASTLE\engineering\install.mjs D:\Projects\NERD-CASTLE\tools\workbench --stack typescript`. It restores the gate, the hook, the agents, the review skill and `.gitattributes`, and writes a `CLAUDE.md` with the nc-kit block (no README exists on the orphan yet).
5. This plan file is untracked and survives the switch. S1.1 commits it.

From here every slice commits on `main` until the cutover (no PR is possible: there is no base). Chunks 2 and 3 use feature branches and PRs.

## 5. Repo layout (target at 1.0.0)

```
.github/workflows/
  release.yml            # tag vX.Y.Z -> tauri-action -> GitHub Release + latest.json
  ci.yml                 # push and PR: types, lint, tests, Rust checks on windows-latest
.githooks/pre-commit     # kit
.claude/                 # kit agents and skill
tools/check.mjs, tools/lib.mjs   # kit gate (do not edit here)
check.config.json        # gate steps (section 8)
CLAUDE.md                # nc-kit block
README.md                # what the app is, dev setup, gate, tools, Shopify setup, known pitfalls
docs/
  plan-workbench-1.0.md  # this file, with a Progress heading
  learning-tauri.md      # Andrei's notes: 2 to 4 entries per slice
  releasing.md           # versions, tags, the signing key, local unsigned builds
index.html
package.json             # version source; packageManager pnpm
pnpm-lock.yaml
tsconfig.json            # Hephaestus floor (section 8)
vite.config.ts           # port 1420, strictPort
vitest.config.ts         # src/**/*.test.ts, scripts/**/*.test.mjs
eslint.config.mjs        # the Hephaestus rule set
.prettierrc.json, .prettierignore
playwright.config.ts     # disc parity only, channel msedge
scripts/
  release-tag.mjs        # checks the pushed tag matches package.json
  release-tag.test.mjs
src/
  main.tsx               # fonts, tokens, App
  app/
    App.tsx              # view state: home or an open tool; keeps opened tools mounted
    TitleBar.tsx         # drag region, title, tool colour, min/max/close
    HomeGrid.tsx         # one tile per registry entry
    StatusBar.tsx        # status text from the active tool, app version
    openFiles.ts         # takes pending open-file paths, listens for more, routes via the registry
    update/UpdatePrompt.tsx, update/updateCheck.ts, update/progress.ts (+ test)
  ui/                    # shared retro pieces: RetroWindow, Button, Field, NumberField, ColorField,
                         # Select, Checkbox, Dialog, ProgressBar, SectionHeader
  styles/tokens.css, base.css, fonts.css
  lib/
    platform.ts          # isTauri(); stubs so the UI renders in a plain browser for checks
    files.ts             # readFileBytes, writeFileBytes (raw IPC body), dialogs
  tools/
    types.ts             # the registry interface (section 6)
    registry.ts, registry.test.ts
    disc-studio/
      index.ts           # registry entry
      DiscStudio.tsx, panels/*.tsx, DiscIcon.tsx
      engine/
        geometry.ts      # mm/px, radii, band path, safe line, toLocal, hit test (+ test)
        maskAlpha.ts     # uploaded mask: luminance or alpha to mask alpha (+ test)
        pngDpi.ts        # crc32, pHYs chunk insert (+ test)
        project.ts       # .nerd / .disc.json parse (zod), serialize, next id (+ test)
        svg.ts           # prepareSvg (+ test, happy-dom)
        layerOps.ts      # reorder, duplicate, remove, cover/fit width, nudge, stroke thinning (+ test)
        document.ts      # the mutable document + subscribe/getVersion
        render.ts        # buildMasks, compose, draw (canvas; proven by the parity test)
        pointer.ts       # move, eraser and restore strokes, wheel, keys
    voucher/
      index.ts, VoucherTool.tsx, PreviewCanvas.tsx, SettingsPanel.tsx, VoucherIcon.tsx
      core/
        codeGen.ts       # unique codes (+ test, ported from tests/test_code_gen.py)
        codeLayout.ts    # glyph positions, centring, baseline (+ test)
        selection.ts     # draw, move, resize by corner, clamp, to image pixels (+ test)
        outputFile.ts    # output name and format from the template (+ test)
        generateGuard.ts # why GENERATE is disabled (+ test)
        drawVoucher.ts   # one function draws a code on a template: preview and export
        generateRun.ts   # codes -> csv -> discount -> images, with progress
      shopify/
        discountInput.ts # DiscountCodeBasicInput incl. the combinesWith rule (+ test)
        collections.ts   # page merge and sort (+ test)
        codeBatches.ts   # split codes for discountRedeemCodeBulkAdd (+ test)
  lib/shopify/
    client.ts            # app-wide: calls the Rust shopify_graphql command, parses with zod
  app/settings/
    ShopifySection.tsx   # gear Settings section: client id/secret, Connect, status
src-tauri/
  Cargo.toml, build.rs, tauri.conf.json, tauri.unsigned.conf.json
  capabilities/default.json
  icons/                 # from `tauri icon` on our own SVG
  src/
    main.rs, lib.rs      # builder: plugins, commands, setup
    open_files.rs        # argv -> paths; single-instance forward; pending queue (+ cargo tests)
    files.rs             # read_file_bytes, write_file_bytes
    fonts.rs             # list_font_families (fontdb)
    settings.rs          # settings.json in the app config dir; old config import (+ cargo tests)
    secrets.rs           # Windows Credential Manager through keyring
    shopify/oauth.rs     # localhost:8765 callback, state check, token exchange (+ cargo tests)
    shopify/graphql.rs   # shopify_graphql command
tests/disc-parity/
  reference/disc-studio.html   # the original file, unchanged
  fixtures.ts                  # builds fixture projects inside the page
  parity.spec.ts
```

Tests: Vitest `*.test.ts` beside the code (one convention). Rust: `#[cfg(test)] mod tests` in the same file. Playwright only for disc parity.

## 6. The tool registry

```ts
// src/tools/types.ts
export type ToolId = "disc-studio" | "voucher";

/** A colour token name from styles/tokens.css, never a raw hex. */
export type ToolColour = "pink" | "blue" | "yellow" | "green";

export interface FileType {
  /** Lower case, with the dot. Longest match wins: ".disc.json" before ".json". */
  extension: string;
  label: string; // "Disc Studio project"
}

export interface OpenRequest {
  path: string;
  /** Changes on every request, so opening the same file twice still reaches the tool. */
  nonce: number;
}

/** What the shell runs when the user asks to save a tool's unsaved work. */
export interface UnsavedWork {
  /** True when the work is safe on disk; false when the user cancelled or it failed. Never throws. */
  save(): Promise<boolean>;
}

export interface ToolContext {
  openRequest: OpenRequest | null;
  setStatus(text: string): void;
  /** The save action while the tool holds unsaved work, null when it does not (0.6.2, section 17.3). */
  setUnsavedWork(work: UnsavedWork | null): void;
}

export interface ToolDefinition {
  id: ToolId;
  name: string;
  colour: ToolColour;
  icon: ComponentType<{ size: number }>;
  component: LazyExoticComponent<ComponentType<ToolContext>>;
  fileTypes: readonly FileType[];
}
```

```ts
// src/tools/registry.ts
export const TOOLS: readonly ToolDefinition[];
export function getTool(id: ToolId): ToolDefinition; // throws on an unknown id
export function resolveToolForFile(path: string): ToolDefinition | null;
```

Entries at 1.0.0: Disc Studio (pink, `.nerd` and `.disc.json`), Voucher Generator (blue, no file types). The home screen and the title bar take colour and name from here. Adding a tool is a folder plus one line in `TOOLS`.

## 7. The look

Reference: the retro-tech image Andrei shared (pastel title bars, thick black outlines, hard offset shadows, mono labels, chunky buttons). It is stock art: never commit it. The briefs describe it in words and point at `prototype-jsx/styles.css` for the layout.

Tokens (`src/styles/tokens.css`, light only; dark mode later redefines the same names):

```css
:root {
  --ink: #1b1b1f; /* outlines and text */
  --paper: #f7f3ea; /* window bodies */
  --desk: #e9e4f2; /* behind the windows, with the prototype's dot grid */
  --field: #ffffff;
  --muted: #6b6672;
  --title-pink: #f4a6c8; /* Disc Studio */
  --title-blue: #7fb8e6; /* Voucher Generator */
  --title-yellow: #ffe27a; /* home */
  --title-green: #8fd9a8;
  --danger: #ee6b6b;
  --ok: #5fc48a;
  --border: 2px solid var(--ink);
  --border-heavy: 3px solid var(--ink);
  --shadow-hard: 4px 4px 0 var(--ink);
  --shadow-pressed: 1px 1px 0 var(--ink);
  --radius: 6px;
  --font-mono: "IBM Plex Mono", Consolas, monospace;
  --font-sans: "Inter", "Segoe UI", sans-serif;
}
```

- Windows: paper body, ink border, hard shadow, a 32px title bar in the tool colour with a mono title and square outlined `_ □ ×` buttons.
- Buttons: ink border, hard shadow; pressed moves 3px down-right and the shadow shrinks. The primary action (GENERATE!, Export print PNG) is large.
- Labels and section headers: mono, upper case, letter-spaced. Fields: Inter, white, ink border.
- Home: tiles like the folder icons in the reference, each label in a boxed mono tag.
- No raw hex outside `tokens.css`. Window size 1360 x 860 by default, minimum 1100 x 720.

## 8. The gate

`check.config.json` (S1.1 writes it; `tools/check.mjs` runs steps in order):

| Step           | Command                                                                          | Fast |
| -------------- | -------------------------------------------------------------------------------- | ---- |
| format         | `corepack pnpm exec prettier --check .`                                          | yes  |
| lint           | `corepack pnpm exec eslint .`                                                    | yes  |
| rust-format    | `cargo fmt --manifest-path src-tauri/Cargo.toml --check`                         | yes  |
| secrets-staged | `gitleaks git --staged --no-banner --redact`                                     | yes  |
| types          | `corepack pnpm exec tsc --noEmit`                                                | no   |
| tests          | `corepack pnpm exec vitest run`                                                  | no   |
| web-build      | `corepack pnpm exec vite build`                                                  | no   |
| rust-lint      | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | no   |
| rust-tests     | `cargo test --manifest-path src-tauri/Cargo.toml`                                | no   |
| disc-parity    | `corepack pnpm exec playwright test` (added in S2.2)                             | no   |
| secrets        | `gitleaks git --no-banner --redact`                                              | no   |

- `web-build` runs before the Rust steps: `tauri::generate_context!` fails when `frontendDist` (`../dist`) does not exist.
- The first Rust run compiles Tauri cold (several minutes). Later runs are incremental. Coders run `cargo build --manifest-path src-tauri/Cargo.toml` once in the background at the start.
- `tsconfig.json` uses the Hephaestus floor: `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `isolatedModules`, `noEmit`, plus `jsx: react-jsx`.
- ESLint holds only the five Hephaestus rules (`D:\Projects\HEPHAESTUS\eslint.config.mjs`).
- There is no Rust stack file in the kit. The Rust steps above are the floor: rustfmt defaults, clippy with warnings as errors, unit tests for pure functions.

## 9. Pure logic that must be unit-tested

Vitest (TypeScript):

| Module                             | What the tests pin                                                                                                                                                                                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/registry.ts`                | unique ids; `.nerd` and `.disc.json` go to Disc Studio, case-insensitive, longest extension wins; unknown extension gives null                                                                                                                                  |
| `app/update/progress.ts`           | percent from downloaded and total bytes; unknown total gives an indeterminate state, never NaN                                                                                                                                                                  |
| `scripts/release-tag.mjs`          | `v0.5.0` matches `0.5.0`; a missing `v`, a mismatch or a pre-release suffix fail with a clear message                                                                                                                                                           |
| `disc-studio/engine/geometry.ts`   | px per mm at 300 dpi; canvas size with bleed; built-in mask radii with and without margin; the band arc path string for a known disc (literal); safe-line radius; `toLocal` with rotation and mirror; hit test of a rotated box                                 |
| `engine/maskAlpha.ts`              | image with alpha keeps it; opaque image maps luminance 200 to 0 and 245 to 255; RGB always set to 0                                                                                                                                                             |
| `engine/pngDpi.ts`                 | crc32 of a known string (literal); pHYs inserted after IHDR, 21 bytes, ppm = round(dpi / 0.0254), unit byte 1; a non-PNG input throws                                                                                                                           |
| `engine/project.ts`                | a v1 file written by the HTML (literal) parses; wrong `app` throws; missing settings fall back to defaults; next id from layers and image ids; serialize then parse round-trips                                                                                 |
| `engine/svg.ts`                    | adds a viewBox from width/height; 1000 x 1000 fallback; long side set to 4096 keeping ratio; a non-SVG root throws                                                                                                                                              |
| `engine/layerOps.ts`               | move up and down at the ends; duplicate offsets by 2 mm and copies strokes deeply; cover and fit widths for wide and tall images; stroke point thinning at 0.15 x radius                                                                                        |
| `voucher/core/codeGen.ts`          | the 13 cases of `tests/test_code_gen.py` (prefix, length, count, zero count, uniqueness when tight, no ambiguous characters, numbers only, the 10x pool rule at and under the edge, zero length, pool checked against the chosen alphabet); randomness injected |
| `voucher/core/codeLayout.ts`       | per-glyph x positions with spacing; horizontal centring floors like Python `//`; baseline `y + (h + ascent - descent) / 2`                                                                                                                                      |
| `voucher/core/selection.ts`        | draw clamps to the image; move clamps on all four sides; each corner resize keeps the 8px minimum; normalised to image pixels rounds like Python                                                                                                                |
| `voucher/core/outputFile.ts`       | `.jpg` and `.jpeg` give JPG at quality 0.95; `.png` and `.webp` give PNG; file name is the code plus extension                                                                                                                                                  |
| `voucher/core/generateGuard.ts`    | the four reasons in Python's order: image, selection, save path, prefix                                                                                                                                                                                         |
| `voucher/shopify/discountInput.ts` | all products vs collections; numeric ids become collection GIDs; percentage divided by 100; `combinesWith` = order false, product true, shipping true; usage limit, minimum subtotal (2 decimals) and end date only when set                                    |
| `voucher/shopify/collections.ts`   | pages merged in order and sorted by title, case-insensitive                                                                                                                                                                                                     |
| `voucher/shopify/codeBatches.ts`   | first code goes to the create call; the rest split at the bulk-add limit                                                                                                                                                                                        |

Cargo tests (Rust): `open_files::paths_from_args` (skips the exe and flags), `shopify::oauth` (authorize URL; callback parse: error param, state mismatch, missing code, good code), `settings` (defaults, partial file, old `~/.nerdworkbench/config.json` import keeps store, client id and API version, and moves token and secret out).

Not unit-tested, on purpose: React components, the canvas drawing in `render.ts` (the parity test covers it), Tauri wiring, the updater call, the HTTP calls.

## 10. Every slice brief carries these lines

- The slice brief format of the Hermes rulebook (`D:\Projects\HERMES\docs\engineering\multi-agent-work.md` section 5), pointers only.
- Read: `CLAUDE.md` (nc-kit block), the core rules, `engineering/stacks/typescript.md`, this plan's section for the slice, and earlier Progress lines.
- **Add 2 to 4 short entries to `docs/learning-tauri.md`** on the Tauri, Rust or tooling ideas this slice used for the first time. Each entry: a heading, two to four plain sentences, one `path:line` pointer.
- Add one line under **Progress** at the end of this file.
- Gate green, one commit, the `Co-Authored-By` trailer the session gives.
- Nothing live: no tag push, no GitHub settings, no Shopify write, no Plane write.
- UI check: `corepack pnpm tauri dev`, the window at its 1100 x 720 minimum and maximised at 1920 x 1080. Phone width does not apply. The Vite URL (`http://localhost:1420`) renders with platform stubs, so a web-tester can check layout there.

---

## 11. Chunk 1: shell and updater (NERDC-149), branch `main`, version 0.5.0

Done when: a `v0.5.0` tag builds an installer, Andrei installs it with no admin prompt, and a `v0.5.1` tag makes the installed app offer the update.

### S1.1 Scaffold, registry and gate (about 90k, Sonnet)

Goal: `corepack pnpm tauri dev` opens a window showing a plain home grid of the two registry tools, with the TypeScript + Rust gate green.

Files:

- New `package.json` (`packageManager` pnpm, version `0.5.0`, scripts `dev`, `build`, `tauri`), `pnpm-lock.yaml`, `index.html`, `vite.config.ts` (port 1420, `strictPort`), `tsconfig.json`, `vitest.config.ts`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`.
- New `src-tauri/` from `corepack pnpm exec tauri init --ci` with app name, window title, `frontendDist ../dist`, `devUrl http://localhost:1420`, then: identifier `eu.nerdcastle.workbench`, `productName` `Nerds Workbench`, version `../package.json`, window 1360 x 860, min 1100 x 720, `dragDropEnabled: false`, CSP (`default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:`).
- New `src/main.tsx`, `src/app/App.tsx`, `src/app/HomeGrid.tsx` (unstyled), `src/tools/types.ts`, `src/tools/registry.ts`, two placeholder tool components and icons, `src/lib/platform.ts`.
- Dependencies: react, react-dom, zod (both later tools use it; adding it now avoids a lockfile clash between parallel slices), `@tauri-apps/api`, `@tauri-apps/cli`, typescript, vite, `@vitejs/plugin-react`, vitest, eslint, typescript-eslint, prettier.
- New `check.config.json` (section 8, without `disc-parity`), `.gitignore` (node_modules, dist, `src-tauri/target`, `src-tauri/gen/schemas`, test-results, playwright-report, `.env`, `*.key`, `.mcp.json`, `.venv`), `.gitattributes` (add `*.woff2 binary`, `*.icns binary`).
- New `README.md` (what, dev setup with the prerequisites of section 3, gate, layout), `docs/learning-tauri.md` (intro + first entries), commit this plan.

Test first: `src/tools/registry.test.ts` (section 9 row). Red with an empty `TOOLS`, then green.
Docs: README, learning-tauri.
Verify: gate green; `corepack pnpm tauri info` clean; `corepack pnpm tauri dev` shows two tiles; clicking a tile shows its placeholder.
Risks: the first Rust compile is slow (start it early). `tauri init` may prompt without `--ci`. Prettier must ignore `src-tauri/target` and `pnpm-lock.yaml`.

### S1.2 Retro shell and home grid (about 100k, Sonnet)

Goal: the app looks like the retro reference: home grid of tool icons, each tool in a window with its own title-bar colour, custom title bar that drags, minimises, maximises and closes.

Files:

- New `src/styles/tokens.css`, `base.css`, `fonts.css` (`@fontsource/ibm-plex-mono` 400/600/700, `@fontsource/inter` 400/500/600/700).
- New `src/app/TitleBar.tsx` (`data-tauri-drag-region`, window API calls), `src/app/StatusBar.tsx` (tool status text, app version from `getVersion()`).
- Rework `src/app/App.tsx` (home vs tool view; opened tools stay mounted; Home button), `src/app/HomeGrid.tsx`.
- New `src/ui/`: RetroWindow, Button, Field, NumberField, ColorField, Select, Checkbox, Dialog, ProgressBar, SectionHeader.
- Tool icons: `src/tools/disc-studio/DiscIcon.tsx`, `src/tools/voucher/VoucherIcon.tsx` (inline SVG in the retro line style, drawn by us).
- `src-tauri/tauri.conf.json`: `decorations: false`. `src-tauri/capabilities/default.json`: `core:window:allow-start-dragging`, `allow-minimize`, `allow-toggle-maximize`, `allow-close`.

Test first: nothing unit-testable, because this slice is markup, styling and window wiring. The registry test from S1.1 stays green.
Docs: README (the look, where tokens live), learning-tauri (capabilities, drag region, `decorations`).
Verify: in `tauri dev` at minimum size and maximised: drag, double-click maximise, minimise, close; home tiles open tools with the right title colour; a web-tester checks the Vite URL against section 7 at 1100 x 720 and 1920 x 1080.
Risks: no Windows snap-layout flyout on a custom title bar (accepted). Fonts must load offline: check with the network off. Keep every colour a token.

### S1.3 Installer, updater and release pipeline (about 90k, Sonnet)

Waits on: S1.2, and Andrei's signing key (below).

Before it starts, Andrei (not an agent) generates the updater key and keeps the private half out of every repo:
`corepack pnpm tauri signer generate -w "$env:USERPROFILE\.tauri\nerds-workbench.key"`. He stores the password in his password manager and backs up the key file. Losing it means installed apps can never update again. The brief gets the **public** key only.

Goal: `corepack pnpm tauri build` makes a per-user NSIS installer; on start the installed app checks for an update and offers "Update now / Later"; a tag workflow is ready.

Files:

- `src-tauri/tauri.conf.json`: `bundle.targets ["nsis"]`, `bundle.windows.nsis.installMode "currentUser"`, `bundle.createUpdaterArtifacts true`, `plugins.updater` (pubkey, endpoint `https://github.com/RedGuyFromHell/NerdsWorkbench/releases/latest/download/latest.json`, `windows.installMode "passive"`), icons.
- New `src-tauri/tauri.unsigned.conf.json` (`createUpdaterArtifacts false`) and a `build:unsigned` script, for local builds without the private key.
- `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`: `tauri-plugin-updater`, `tauri-plugin-process`. Capabilities: `updater:default`, `process:allow-restart`.
- New `src-tauri/icons/source.svg` (our own simple app icon), then `corepack pnpm tauri icon src-tauri/icons/source.svg`.
- New `src/app/update/updateCheck.ts` (skip in dev; offline start logs at debug and carries on), `UpdatePrompt.tsx` (Dialog with version and notes, Update now / Later, ProgressBar), `progress.ts`.
- New `scripts/release-tag.mjs` + test.
- New `.github/workflows/release.yml`: on tag `v*`, `windows-latest`, `permissions: contents: write`; checkout, setup-node 24, `corepack enable`, `pnpm install --frozen-lockfile`, Rust stable, rust-cache on `src-tauri`, `node scripts/release-tag.mjs ${{ github.ref_name }}`, `tauri-apps/tauri-action` with `GITHUB_TOKEN`, `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, `tagName` the pushed tag, release name "Nerd's Workbench vX.Y.Z", not a draft. Actions pinned to a version.
- New `.github/workflows/ci.yml`: push and PR on `windows-latest`: types, lint, tests, web-build, clippy, cargo test (no gitleaks there; the hook and gate cover it).
- New `docs/releasing.md`: bump `package.json`, commit, tag, push the tag; what latest.json is; the key and its secrets; `build:unsigned`.

Test first: `src/app/update/progress.test.ts` and `scripts/release-tag.test.mjs` (section 9 rows).
Docs: README (install and update), releasing.md, learning-tauri (plugins, updater signing, NSIS modes).
Verify: gate green; `corepack pnpm build:unsigned` produces `src-tauri/target/release/bundle/nsis/*.exe`; installing it shows no UAC prompt and lands under `%LOCALAPPDATA%`; the app starts and logs the update check without crashing while the endpoint does not exist yet. The real update test is in the cutover.
Risks: gitleaks may flag the public key in `tauri.conf.json` as high-entropy: if so, add its fingerprint to `.gitleaksignore` in the same commit, with the reason. tauri-action input names change between majors: the coder checks its README for the pinned version (a researcher note if needed).

### C1 Cutover and first release (main session, needs Andrei's sign-off)

These steps publish code and binaries and change GitHub. The plan cannot avoid them: the updater endpoint only works on a public repo's Releases, and "done" for chunk 1 is an installed app that updates.

1. Secret check of the new tree: `node tools/check.mjs` (includes `gitleaks git` on the new history); `git ls-files` reviewed for `.key`, `.env`, `.mcp.json`, `secret`, `token`; `tauri.conf.json` holds only the public key.
2. Local safety copy: `git bundle create D:\Backups\nerds-workbench-legacy.bundle --all`.
3. Backup and new repo (question 2, recommended route):
   - `gh repo rename NerdsWorkbench-legacy -R RedGuyFromHell/NerdsWorkbench` (stays private).
   - `gh repo view RedGuyFromHell/NerdsWorkbench-legacy --json visibility` shows PRIVATE; `git ls-remote https://github.com/RedGuyFromHell/NerdsWorkbench-legacy.git` lists `master` and `chore/python-stack`.
   - `gh repo create RedGuyFromHell/NerdsWorkbench --public --description "Nerd Castle desktop tools"`.
   - `git remote rename origin legacy`, `git remote set-url legacy https://github.com/RedGuyFromHell/NerdsWorkbench-legacy.git`, `git remote add origin https://github.com/RedGuyFromHell/NerdsWorkbench.git`, `git push -u origin main`. Never `git push --all` to `origin`.
   - Fallback route (if Andrei keeps the force-push): create a private `NerdsWorkbench-legacy`, `git push legacy --all` and `--tags`, then `git push --force origin main`, `gh repo edit --default-branch main`, delete remote `master` and `chore/python-stack`, `gh repo edit --visibility public --accept-visibility-change-consequences`. PR #1 still shows the old commits.
4. Andrei sets the secrets himself: `gh secret set TAURI_SIGNING_PRIVATE_KEY -R RedGuyFromHell/NerdsWorkbench` (paste from the key file) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. The key never appears in the chat.
5. `git tag v0.5.0`, `git push origin v0.5.0`, `gh run watch`. Download the installer from the release, install it, start it.
6. Bump to 0.5.1 (a visible change: the status bar shows the version), commit, tag, push. Start the installed 0.5.0: the prompt appears, Update now, the app comes back as 0.5.1.
7. KB: `CLAUDE.md` routing row for Nerd's Workbench now says "desktop tools app (Tauri)"; `ONBOARDING.md` if it names the old Python setup. Plane NERDC-149 closed with an outcome comment, the estimate against real context per slice.

---

## 12. Chunk 2: Disc Studio (NERDC-150), branch `feat/disc-studio`, version 0.6.0

Done when: the parity test shows identical pixels for every fixture; open, save, add image, mask and export use native dialogs; double-clicking a `.nerd` file opens it in Disc Studio, also when the app is already running.

Source: the original `disc-studio.html` (629 lines), now kept unchanged at `tests/disc-parity/reference/disc-studio.html`; every later brief points at that copy, with line ranges.

### S2.1 Disc engine: pure logic (about 85k, Sonnet)

Goal: every pure decision of Disc Studio exists as a tested TypeScript module with the HTML's exact maths.
Files: new `src/tools/disc-studio/engine/geometry.ts`, `maskAlpha.ts`, `pngDpi.ts`, `project.ts`, `svg.ts`, `layerOps.ts`, each with its `.test.ts`; dev dependency `happy-dom` (svg test only, per-file environment comment).
Source lines: masks 138-192, box/transform/toLocal 197-218, svg 416-429, pHYs 459-473, project 480-496, layer ops 336-342 and 396-406, pointer thinning 551-557, hit 519-527.
Test first: `pngDpi.test.ts` (literal crc32 of `"IEND"` = `0xAE426082`), then the rest in section 9 order.
Docs: learning-tauri (zod at the boundary, happy-dom environment), README (Disc Studio section stub).
Verify: gate green.
Risks: copying a constant wrong silently breaks parity later. Keep the HTML's numbers literally (1.15 line height, 4096 SVG side, 200/45 luminance ramp) as named constants, and say in each module header that S2.2's parity test is the final judge.

### S2.2 Render port and parity harness (about 105k, Sonnet; Fable medium if parity is still off after two tries)

Goal: `render.ts` produces pixels identical to `disc-studio.html` for the same project, proven by an automated test.
Files:

- New `tests/disc-parity/reference/disc-studio.html` (unchanged copy).
- New `src/tools/disc-studio/engine/document.ts` (settings, layers, images, mask, `subscribe`, `getVersion`, `requestDraw`), `render.ts` (`buildMasks`, `compose`, `draw`; source lines 138-192 and 241-314).
- New `tests/disc-parity/parity.html` + `parity-entry.ts` (dev-only page that loads the engine; not in the app build), `fixtures.ts`, `parity.spec.ts`, `playwright.config.ts` (channel `msedge`, Vite dev server as `webServer`).
- `check.config.json`: add `disc-parity` (fail, not fast). Dev dependency `@playwright/test`.
  How the test works: both pages are served by Vite. Playwright routes `fonts.googleapis.com` to our `src/styles/disc-fonts.css`, so both sides load the same font files. In each page a fixture builder draws its test images on a canvas, builds the project JSON, and opens it (`window.openProject(new File(...))` in the reference, the engine's open in the port). Both compose; the test compares `getImageData` byte for byte.
  Fixtures (100 dpi to keep them fast, one at 300 dpi): built-in mask with band and curve; uploaded opaque mask (luminance path); text layers (Cinzel, Bebas Neue, bold, italic, spacing, outline); eraser and restore strokes, hard and soft, on a rotated mirrored layer; tint, opacity and the three clip modes; an SVG layer; the preview view (`draw(false)`).
  Test first: `parity.spec.ts` with the first fixture, red before `render.ts` exists.
  Docs: README (how to run parity, why msedge), learning-tauri (why WebView2 is Edge's engine).
  Verify: gate green including `disc-parity`; one deliberate one-pixel change in `render.ts` turns it red (then restore).
  Risks: the soft eraser uses `ctx.filter = blur(...)`, which can differ between GPU and software canvas; both pages run in the same browser, so it should match. If one fixture stays off by a few pixels, stop and report with a diff image: do not loosen the comparison without Andrei's yes.

### S2.3 Disc Studio screen: settings, layers, properties, move tool (about 105k, Sonnet)

Goal: Disc Studio works inside the app for building a design: disc and mask settings, view options, layer list, the properties panel, add text, add image from a dropped file, move with drag, wheel resize and rotate, Cover / Fit / Centre / Copy.
Files: new `src/tools/disc-studio/DiscStudio.tsx`, `panels/DiscSettings.tsx`, `panels/LayerList.tsx`, `panels/LayerProperties.tsx`, `panels/AddPanel.tsx`, `engine/pointer.ts` (move part); `src/tools/disc-studio/index.ts` (real component).
Source lines: layout 44-108, list and props 319-406, adding 432-456, pointer move and wheel 515-578.
Test first: nothing new is unit-testable, because the decisions moved to S2.1 modules (this slice calls them). If a new decision appears in a component, extract it into `layerOps.ts` with a test.
Docs: README (Disc Studio usage, the shortcuts), learning-tauri.
Verify: gate green; in `tauri dev`, rebuild the second parity fixture by hand and compare the view by eye; a dropped PNG and SVG both land as layers; the low-DPI warning shows in the status bar (the HTML only logged it).
Risks: React re-rendering on every pointer move; panels must read through `useSyncExternalStore` and the canvas must draw on `requestAnimationFrame` like the HTML's `req()`. The pink title bar and three-column layout must fit 1100 x 720.

### S2.4 Eraser, keyboard, native dialogs and export (about 95k, Sonnet)

Goal: the rest of the HTML's behaviour, with native file dialogs: eraser and restore with brush and softness, Ctrl+Z, arrow nudges, Delete, Ctrl+D, V/E/R; Add image, Upload mask, Open and Save project, Export print PNG and Export preview through Windows dialogs.
Files:

- New `src-tauri/src/files.rs` (`read_file_bytes(path)`, `write_file_bytes` taking the raw IPC body and a percent-encoded path header); `lib.rs` registers them; `tauri-plugin-dialog` added, capability `dialog:default`.
- New `src/lib/files.ts` (wrappers, `isTauri()` stubs). `engine/pointer.ts` (eraser part, keys).
- `panels/*`: buttons call the dialogs. Save writes `.nerd` (question 1); Open accepts `.nerd` and `.disc.json`. Export writes the pHYs PNG to the chosen path.
- Errors show in the retro `Dialog`, never `alert()`.
  Source lines: eraser 210-240 and 535-567, keys 579-594, export 464-477, project 480-496.
  Test first: `src/lib/files.test.ts` for the path header encoding (non-ASCII and spaces round-trip), if the encoding is our code; otherwise nothing unit-testable, said so.
  Docs: README (project files, `.nerd`), learning-tauri (commands, raw IPC bodies, capabilities for dialogs).
  Verify: gate green; save a project, reopen it, export: the PNG opens in a print app at the right size (pHYs); a `.disc.json` saved by the HTML opens in the app, and a `.nerd` from the app opens in the HTML's Open (it accepts `.json`, so rename to check).
  Risks: large data-URL projects through IPC: use the raw body, not a JSON number array. Keyboard shortcuts must not fire while typing in a field (the HTML's `closest("input,textarea,select")` guard).

### S2.5 File association and single instance (about 65k, Sonnet)

Goal: double-clicking a `.nerd` file opens it in Disc Studio, in the running app if one is open.
Files:

- `src-tauri/tauri.conf.json`: `bundle.fileAssociations` for `disc` (name "Disc Studio project", role Editor).
- New `src-tauri/src/open_files.rs`: `paths_from_args`, a pending queue in managed state, `take_pending_open_files` command, `open-file` event; `tauri-plugin-single-instance` forwards a second launch's argv and focuses the window.
- New `src/app/openFiles.ts`: on mount take the pending paths, then listen; route through `resolveToolForFile`; unknown types show a Dialog.
- Version `0.6.0` in `package.json`.
  Test first: cargo test for `paths_from_args`; registry routing is covered by S1.1's test (add the `.disc.json` longest-match case if missing).
  Docs: README, releasing.md (what the installer registers), learning-tauri (argv, single instance, managed state, events).
  Verify: gate green; `build:unsigned`, install, double-click a `.nerd` with the app closed and with it open; both land in Disc Studio.
  Risks: the event can fire before React listens: the pending queue is why. The single-instance plugin must be the first plugin registered.

### C2 End of chunk 2 (main session)

Review on two axes (standards and spec, two fresh agents: the chunk has five slices). One fixer slice for accepted findings. PR to `main`, merge. Tag `v0.6.0` (**needs Andrei's sign-off**: it ships to both PCs through the updater). KB `CLAUDE.md` row and `business/projects/_index.md` if it lists Disc Studio. Plane NERDC-150 closed with the outcome and the slice numbers.

---

## 13. Chunk 3: Voucher Generator to parity (NERDC-151), branch `feat/voucher`, version 1.0.0

Done when: every feature of the PyQt v0.4.2 voucher tab works in the new app (the README's "What it does" list), a real small run creates a discount in Shopify and the matching images, and 1.0.0 is released.

Python sources to read, by slice: `app/core/code_gen.py`, `app/core/image_gen.py:84-129`, `app/core/worker.py`, `app/shopify_client.py`, `app/oauth_flow.py`, `app/config.py`, `app/ui/settings_panel.py`, `app/ui/preview_canvas.py:229-432`. They live on `master` (and the legacy repo): a brief points at `git show master:app/core/code_gen.py`.

### S3.1 Voucher core: pure logic (about 85k, Sonnet)

Goal: all voucher decisions as tested TypeScript.
Files: new `src/tools/voucher/core/codeGen.ts`, `codeLayout.ts`, `selection.ts`, `outputFile.ts`, `generateGuard.ts`; `src/tools/voucher/shopify/discountInput.ts`, `collections.ts`, `codeBatches.ts`; each with its `.test.ts`.
Before coding: a researcher confirms the per-call code limit of `discountRedeemCodeBulkAdd` for API 2026-04 (the Python sends every code in one call; the limit is believed to be 250). The answer goes in a notes file and becomes a named constant.
Test first: `codeGen.test.ts` with the 13 Python cases (`git show master:tests/test_code_gen.py`), randomness injected.
Docs: README voucher section stub (pitfalls carried over from the old README: the singular `code`, no `DiscountCodeBulkCreation` fragment).
Verify: gate green.
Risks: rounding differences from Python (`//` floors, `round` is banker's rounding in Python: decide per call site and pin it in a test).
Parallel: shares no file with any chunk 2 slice and waits only on chunk 1. It may run beside chunk 2 on its own branch.

### S3.2 Shopify connection: settings, Credential Manager, OAuth, GraphQL (about 110k, Fable medium)

Fable because: security code (OAuth state check, the client secret and token storage, a localhost listener).
Goal: in the gear Settings window (the "Shopify connection" section S1.3 left empty), the user enters the client ID and secret, clicks Connect, approves in the browser, and the app stores the token in Windows Credential Manager; collections load in the Voucher tool.
Decision (Andrei, 2026-11-18): the Shopify connection is app-wide, not the Voucher tool's. It lives in the gear menu, and the client lives in `src/lib/shopify/`, because more tools will use it later. Tool-only settings (voucher font, colours) stay in the tool.
Files:

- New `src-tauri/src/settings.rs`: `settings.json` in the app config dir (store, client id, API version `2026-04` as one named default); one-time import of `~/.nerdworkbench/config.json` (token and secret move to Credential Manager, then the old file is rewritten without those two keys, and the UI says so).
- New `src-tauri/src/secrets.rs`: `keyring` (Windows native), service `nerds-workbench`, entries `shopify-token` and `shopify-client-secret`; commands `save_client_secret`, `has_token`, `disconnect`.
- New `src-tauri/src/shopify/oauth.rs`: listener on `127.0.0.1:8765` and `[::1]:8765` (browsers may resolve `localhost` to either), `/callback` only, 120 s timeout, random `state`, browser opened through `tauri-plugin-opener`, token exchange with `reqwest`, the scopes from README (`read_price_rules,write_price_rules,read_discounts,write_discounts,read_products`). Command `shopify_connect`.
- New `src-tauri/src/shopify/graphql.rs`: command `shopify_graphql(query, variables)`; reads the token from Credential Manager; returns data or an error with the HTTP status and the GraphQL messages, never the token.
- New `src/lib/shopify/client.ts` (zod parse of every response) and `src/app/settings/ShopifySection.tsx` (the Connect panel), registered as a section of the gear Settings window. The Voucher tool shows "Not connected - open Settings" with a button that opens that section; it has no connect form of its own.
  Test first: cargo tests for the callback parser and the authorize URL (section 9), then the settings import test.
  Docs: README (Shopify setup, where secrets live, how to disconnect), learning-tauri (managed state, async commands, keyring).
  Verify: gate green; connect against the real store (a read: it creates a token, no store data changes); collections list appears; restart, still connected; Disconnect removes both entries (check in Windows Credential Manager).
  Risks: the redirect URL registered in the Shopify app is `http://localhost:8765/callback` and must stay byte-identical. Port 8765 already in use: say so in the UI. A log line or error must never include the token, the secret or the code.
  Review: the end-of-chunk security review of this slice runs on **Opus high** (user rule: security reviews stay on Opus).

### S3.3 Voucher screen: preview, selection, settings panel (about 110k, Sonnet)

Goal: the voucher screen at parity with the PyQt tab: load a template (jpg, png, webp), draw, move and resize the code area, live WYSIWYG code preview, the three numbered settings sections, the system font list, the GENERATE! button with its disabled reasons.
Files:

- New `src/tools/voucher/VoucherTool.tsx`, `PreviewCanvas.tsx` (template drawn at natural size, CSS-scaled; selection overlay with four corner handles), `SettingsPanel.tsx` (01 Visual, 02 Discount, 03 Code; defaults as in `settings_panel.py`: Impact, 42 px, spacing 2, outline 1, `#4A265A` on `#FFFFFF`, 10 %, usage 1, once per customer on, today to today + 30, `SUMMER-`, 100 vouchers, 8 characters).
- New `src/tools/voucher/core/drawVoucher.ts` (one function for preview and export).
- New `src-tauri/src/fonts.rs`: `list_font_families` with `fontdb`, sorted, deduplicated.
- Status bar: selection size in %, the sample code, as the PyQt status bar.
  Test first: nothing new is unit-testable, because the decisions are S3.1's modules; `drawVoucher` is canvas drawing, checked by eye against a PyQt render of the same settings.
  Docs: README (voucher usage), learning-tauri.
  Verify: gate green; same template and settings in the PyQt app (from `master` or the saved exe) and the new app: the code sits in the same place within a few pixels.
  Risks: canvas font metrics (`fontBoundingBoxAscent/Descent`) are not Qt's: small vertical offsets are expected; centring must still match. A system font that the canvas cannot load falls back silently: check the font is ready with `document.fonts.load` before drawing.

### S3.4 Generate: codes, discount, images, then 1.0.0 docs (about 100k, Fable medium)

Fable because: it writes live discounts (money), and a partial failure must leave a clear state.
Goal: GENERATE! writes `codes.csv` (question 4), creates the discount with the first code, adds the rest in batches, renders every image to the save folder with progress, and shows DONE! or an error dialog.
Files:

- New `src/tools/voucher/core/generateRun.ts` (the order, progress callback, abort between images), wiring in `VoucherTool.tsx` and the button states (idle, generating, done for 2.2 s).
- Images: `canvas.toBlob` JPG at 0.95 or PNG, written with `write_file_bytes`.
- Version `1.0.0`. README rewritten for 1.0 (old PyQt sections removed); `docs/releasing.md` gains "retire the old app" (delete the old exe folder and, after the import, `~/.nerdworkbench`).
  Test first: `generateRun.test.ts` with the Shopify client and the file writer injected as fakes (outside the process): order of calls, batches, CSV before the discount, an error after the discount reports the codes file path.
  Docs: README, releasing.md, learning-tauri.
  Verify: gate green; a dry check with the Shopify client faked in dev; then the live run below.
  Live run (**needs Andrei's sign-off**: it creates a real discount on `nerd-castle-3d.myshopify.com`): 2 codes, prefix `WBTEST-`, 1 %, usage 1, ends today. Check both codes in Shopify admin and the two images, then Andrei deletes the test discount.
  Risks: 100,000 vouchers is the PyQt maximum; yield to the UI every 10 images and keep memory flat (one canvas reused). The `combinesWith` rule comes from `store/admin/discounts.md` in the KB: a `WHY:` comment says what it does, not a ticket.

### C3 End of chunk 3 (main session)

Standards and spec review (two fresh agents) plus a security review of S3.2's files on Opus high. One fixer slice. PR, merge. Tag `v1.0.0` (**needs Andrei's sign-off**). Andrei and Maria update through the prompt; each connects to Shopify once if the import did not carry the token. KB: `CLAUDE.md` row, `store/admin/discounts.md` if it names the old app. Plane NERDC-151 and the parent NERDC-148 closed with outcomes.

---

## 14. Sign-offs in one list

| Step                                                                | Why it is live                                        | Why it cannot be avoided                                                             |
| ------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| C1 repo rename / create / push (or force-push) and making it public | publishes the code; changes GitHub                    | the decision is to go public with a fresh history; the updater needs public Releases |
| C1 secrets set in GitHub                                            | stores the signing key                                | tauri-action must sign updates in CI                                                 |
| Tags `v0.5.0`, `v0.5.1`, `v0.6.0`, `v1.0.0`                         | publish installers that both PCs pull                 | that is the release path Andrei chose                                                |
| S3.2 connect                                                        | creates an access token on the store (no data change) | parity needs a real connection                                                       |
| S3.4 live run                                                       | creates a real discount                               | the only proof the Shopify path works                                                |
| Plane closing at C1, C2, C3                                         | a Plane write                                         | KB hard rule 7                                                                       |

## 15. Found, not in scope

- No Rust stack file in the kit (`engineering/stacks/`): this plan's Rust gate steps could become `stacks/rust.md` later.
- The PyQt worker's `abort()` is never wired to the UI. S3.4 adds abort between images only because the loop needs it; no Cancel button unless Andrei asks.
- Shopify API `2026-04` leaves support around April 2027: a version bump task belongs in Plane.
- `make-disc-art.mjs` in Downloads holds the same mask maths as Disc Studio ("Same maths as make-disc-art.mjs"). After the port, `engine/geometry.ts` should be the one copy.

## 16. Slice table

Estimates are the expected end context of each agent, the 1.5x margin included.

| id   | behaviour                                                         | est.              | waits on             | files (main)                                                                                                                         | model                              | status |
| ---- | ----------------------------------------------------------------- | ----------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ------ |
| S1.1 | window with home grid from the registry; TS + Rust gate green     | 90k               | prep (section 4)     | package.json, vite/ts/eslint configs, src-tauri/*, src/tools/registry.ts, check.config.json, README                                  | Sonnet                             |        |
| S1.2 | retro shell, custom title bar, home grid of icons                 | 100k              | S1.1                 | src/styles/_, src/ui/_, src/app/*, tauri.conf.json, capabilities                                                                     | Sonnet                             |        |
| S1.3 | per-user installer, update prompt, release and CI workflows       | 90k               | S1.2, signing key    | tauri.conf.json, lib.rs, src/app/update/_, scripts/release-tag._, .github/workflows/*, docs/releasing.md                             | Sonnet                             |        |
| C1   | repo switch, v0.5.0, v0.5.1 update proven                         | main session ~20k | S1.3                 | git remotes, GitHub                                                                                                                  | main session                       |        |
| S2.1 | Disc engine pure modules with tests                               | 85k               | C1                   | src/tools/disc-studio/engine/* (pure)                                                                                                | Sonnet                             |        |
| S2.2 | render port, pixel-identical to the HTML, parity test in the gate | 105k              | S2.1                 | engine/document.ts, engine/render.ts, tests/disc-parity/*, playwright.config.ts, check.config.json                                   | Sonnet (Fable medium if stuck)     |        |
| S2.3 | Disc Studio screen: settings, layers, properties, move tool       | 105k              | S2.2                 | src/tools/disc-studio/_.tsx, panels/_, engine/pointer.ts                                                                             | Sonnet                             |        |
| S2.4 | eraser, keys, native dialogs, export                              | 95k               | S2.3                 | src-tauri/src/files.rs, lib.rs, src/lib/files.ts, panels/*, engine/pointer.ts                                                        | Sonnet                             |        |
| S2.5 | `.nerd` association and single instance                           | 65k               | S2.4                 | tauri.conf.json, src-tauri/src/open_files.rs, lib.rs, src/app/openFiles.ts                                                           | Sonnet                             |        |
| S3.1 | voucher pure core with tests                                      | 85k               | C1                   | src/tools/voucher/core/*, src/tools/voucher/shopify/{discountInput,collections,codeBatches}.ts                                       | Sonnet                             |        |
| S3.2 | Shopify connect: settings, Credential Manager, OAuth, GraphQL     | 110k              | S3.1, chunk 2 merged | src-tauri/src/{settings,secrets}.rs, src-tauri/src/shopify/*, lib.rs, src/lib/shopify/client.ts, src/app/settings/ShopifySection.tsx | Fable medium: security code        |        |
| S3.3 | voucher screen: preview, selection, settings panel, fonts         | 110k              | S3.2                 | src/tools/voucher/*.tsx, core/drawVoucher.ts, src-tauri/src/fonts.rs, lib.rs                                                         | Sonnet                             |        |
| S3.4 | generate run: csv, discount, images; 1.0.0 docs                   | 100k              | S3.3                 | core/generateRun.ts, VoucherTool.tsx, README, docs/releasing.md, package.json                                                        | Fable medium: live discount writes |        |

Sum of agent slices: 1,145k (chunk 1: 280k, chunk 2: 455k, chunk 3: 410k). Reviews add about 6 agents of 50k to 70k each, plus the Opus security review.

**Parallel:** S3.1 shares no file with S2.1 to S2.5 and waits only on C1, so it may run beside any chunk 2 slice, on `feat/voucher`. Everything else runs in order: `lib.rs`, `tauri.conf.json`, `capabilities/default.json` and `package.json` are shared hot spots.

## 17. Version 0.6.2: undo, shell navigation, unsaved work

### 17.1 Undo and redo (S1)

- **Snapshots, not commands.** The engine already replaces values and never edits them in place (`replaceLayer`, `patchSetting`, `layerOps`), so a snapshot is six references, not a copy. A command per action would need an inverse for about 20 actions and every new one; a snapshot needs none.
- **What a snapshot holds** (`DiscContent`): `settings`, `layers` (the array), `images` (a `Map`), `mask`, `nextId` and the id of the selected layer. It does not hold `tool`, `brushMm`, `soft` or `hover`: they are view state and not in the project file.
- **Memory.** Layers, strokes, settings and `LoadedImage` objects are shared by reference between snapshots; image pixels and data URLs are never copied. The one thing the engine changes in place is `doc.images` (`images.set` in `actions.ts`), so a snapshot takes a new `Map` only when the key set changed and reuses the last one otherwise. A restore gives the document its own copy of the snapshot's map, so the snapshot is never touched.
- **Captured in one place: `DiscDocument.markChanged()`.** The document keeps the last committed snapshot. On every `markChanged` it compares the current content to it (`sameContent`: settings field by field, layers element by element by identity, mask by identity, image keys). If it differs, a step is recorded; if not (a selection, a tool pick, the brush), no step is, though the remembered selection is updated. No call site in `actions.ts` or the panels changes.
- **One step per user act**, by two rules in the pure module `engine/history.ts`:
  1. A gesture is one step. `attachPointer` calls `beginGesture()` on pointer down (a drag or an eraser stroke) and `endGesture()` on pointer up and pointer cancel. Every change in between merges into the step the first one opened. A press with no change makes no step.
  2. Outside a gesture, the same kind of change merges within `MERGE_WINDOW_MS` (1000). The kind comes from the diff, `changeKey(before, after)`: `settings:<field>` when one setting changed, `layer:<id>:<changed fields, sorted>` when exactly one layer changed and the list is otherwise the same, else `null`. `null` (add, delete, reorder, duplicate, mask upload) never merges. So a burst of typing in the text box, a held stepper, a run of wheel steps or of arrow nudges is one step, and a pause over a second starts a new one. Time comes in as a `now` argument, so the tests need no clock.

  A finished gesture, an undo and a redo seal the last step: the next change never merges into it.

- **Cap.** `MAX_HISTORY_STEPS` is 100; the oldest step falls off. A new change clears the redo list.
- **What clears it.** `DiscDocument.open()` resets the history to the opened project. Nothing else does.
- **Restoring** sets the six fields, points `selected` at the layer with the remembered id (or none), calls `renderer.buildMasks()` when the settings or the mask changed, and then calls `markChanged()`, which sees no difference and records nothing.
- **Keys.** Ctrl+Z (or Meta+Z) is undo; Ctrl+Shift+Z and Ctrl+Y are redo. Both work with no selection.
- **Where the keys stay native.** The old guard `isTypingTarget` blocks our keys in `input, textarea, select, dialog`. That also blocked Ctrl+Z while a `select`, a checkbox or the colour input had focus, where the browser has no undo of its own: changing the font and pressing Ctrl+Z would do nothing. So undo and redo are skipped only in a text entry target (`textarea`, a text-like `input`, `contenteditable`) and inside a `dialog`; every other key keeps the wider `isTypingTarget` guard. Both guards live in `src/lib/keyTargets.ts`, because the shell needs them too (shared code moves down, core rules section 4 rule 3).
- **The old Ctrl+Z is replaced**, not kept beside the new one. It took the last eraser stroke off the selected layer, as the HTML did. A stroke is one history step, so Ctrl+Z still removes the last stroke when it was the last act. That is a change of intent.
- **Parity.** `render.ts`, `toProject()` and `project.ts` are not touched; history only reads and swaps references. The parity harness goes through `DiscDocument.open`, which now also resets the history. `disc-parity` stays byte for byte green.

### 17.2 Shell navigation (S2)

- **Our own screen history, not the browser's.** A pure `ScreenHistory` (`entries`, `index`) in `src/app/screenHistory.ts`. `history.pushState` and `popstate` would give the mouse buttons for free, but `popstate` fires after the move, so the unsaved-work prompt could not stop it, and it cannot be unit-tested.
- **Model.** A screen is `"home"` or a `ToolId`. `visit` drops the forward entries and adds the screen (nothing when it is already the current one). `back` and `forward` move the index and return the same object at an end. `MAX_SCREEN_ENTRIES` is 50. Opening a tile, a file from Explorer, the "< HOME" button and Escape all `visit`, so Back after Escape returns to the tool, as after a link in a browser. Mouse button 3 is back, button 4 is forward.
- **`App.tsx` keeps one state, the history;** the active tool is derived from its current screen. `openedIds` stays as it is.
- **WebView2 does not navigate by itself.** The app is one document: no router, no `pushState`, no `<a href>`, no `location` writes. Its session history has one entry, so WebView2's own back and forward have nowhere to go. The listeners still call `preventDefault`, so a later link or route cannot start doing it silently.
- **Where the buttons are caught.** On `window`, in the capture phase, for button 3 and 4: `mousedown`, `mouseup` and `auxclick` get `preventDefault` and `stopPropagation`; `pointerdown` and `pointerup` get `stopPropagation` only. The move happens once, on `mouseup`. Why the pointer events: the Disc Studio canvas starts a drag on any `pointerdown` (no button check), so a side button over it would grab a layer. Why no `preventDefault` on `pointerdown`: it suppresses the mouse events that follow, and `mouseup` is where we act.
- **Escape** is a `keydown` listener on `window` (bubble phase). It goes home only when all hold: a plain `Escape` (no modifier, not a repeat, not composing), the event is not `defaultPrevented` (a tool that handled Escape itself wins), a tool is on screen, no `dialog[open]` is in the document, and the target is not a typing target (`isTypingTarget`). The decision is the pure `leavesToolOnKey`; the hook only gathers its inputs. A tool that wants Escape for itself must call `preventDefault`.
- **Mouse buttons are ignored while a dialog is open** (same `dialog[open]` check), so Back cannot change the screen under a modal.
- **One hook, two actions.** `useShellNavigation` takes `goHome` and `move(direction)` from `App.tsx`; they are the only ways it changes the screen. S3 puts the unsaved-work check inside them and the hook does not change.

### 17.3 Unsaved work (S3)

- **The contract on `ToolContext`** (`src/tools/types.ts`): `setUnsavedWork(work: UnsavedWork | null)`, stable like `setStatus`, with `UnsavedWork = { save(): Promise<boolean> }`. One call carries both the flag and the action, so they cannot disagree. A tool that never calls it is never asked about. `save()` resolves true when the work is on disk, false when the user cancelled or it failed (the tool has already shown why).
- **The shell decides, in a pure module** `src/app/exitGuard.ts`: `planExit(exit, unsavedIds)` returns the tools to ask about, in order. Leaving a screen (`leave`, from a tool to anywhere else): that tool, if it has unsaved work. Closing the window or restarting for an update (`close`): every tool with unsaved work, the one on screen first. `nextExitStep(pending, outcome)` with outcome `saved`, `skipped`, `cancelled` or `saveFailed` returns the next tool to ask about, `proceed` or `abort`. Cancel, a cancelled native Save dialog and a failed save all abort the whole exit: the screen stays, the window stays open.
- **One function per exit.** `useExitGuard` (`src/app/useExitGuard.ts`) gives `App.tsx` one `requestExit(exit, proceed)`; the HOME button, Escape, the mouse buttons, the window close and "Update now" all call it, through `goHome`, `move` and `askBeforeEnding`. No dirty tool: `proceed()` runs at once. A second request while the dialog is open is ignored. The tools' work lives in a ref, not in state: it matters only at the moment of an exit. Opening a tool or a file (`openTool`) is not an exit: it only adds a screen and the tool left stays mounted with its work.
- **The dialog:** `src/app/UnsavedDialog.tsx` on `src/ui/Dialog.tsx`, title = the tool's name, text "<Tool> has changes that are not saved.", buttons Save (primary), Don't save, Cancel. Escape and the close box are Cancel. While `save()` runs, the buttons are disabled and Escape does nothing.
- **"Don't save" only leaves.** An opened tool stays mounted while hidden, so on the way home nothing is lost: the work stays in the tool and Back (or its tile) brings you back to it. Only closing the window really drops it. The prompt shows on every trip home all the same; changing that to "ask only on close" is a one-line change in `planExit`.
- **"Update now" is guarded.** It restarts the app without a close request, so the same prompt runs before the download starts (`UpdatePrompt` takes `beforeInstall`). Windows shutdown and log-off cannot show our dialog (the web view is killed): accepted, out of scope.
- **The shell shows the tool it asks about.** On a window close with unsaved work in a hidden tool, the shell first visits that tool. WHY: a tool's own error dialog lives inside its host, and a `<dialog>` under a `hidden` parent does not render, so a failed save would fail silently. If the user then cancels, the screen stays on that tool.
- **Window close: the JS hook, not Rust.** `useCloseGuard` registers `getCurrentWindow().onCloseRequested` (through `onWindowCloseRequested` in `src/lib/platform.ts`). The title bar's close button, Alt+F4 and the taskbar all raise the same close request, so one hook covers them. No unsaved work: the handler returns and the API closes the window. Otherwise it calls `preventDefault` and `requestExit`, and on `proceed` it calls `destroy()`. A `try/catch` destroys the window on an unexpected error, so a bug there can never leave a window that cannot be closed. The listen call is async, so a registration that resolves after its cleanup (React StrictMode in dev) unlistens itself. WHY not Rust: it needs the same JS round trip to know the dirty state and would add a command and an event in `lib.rs`.
- **Capability: `core:window:allow-destroy`** in `src-tauri/capabilities/default.json`. The API's `onCloseRequested` calls `destroy()` itself whenever the handler does not prevent the close, and `core:default` does not allow `destroy`. Without the line, registering the hook makes the window impossible to close. `listen` is already covered by `core:default`.
- **Disc Studio:** dirty means "the content differs from the last saved or opened content". `DiscDocument.isDirty()` compares the committed snapshot of 17.1 with a `saved` snapshot through `sameContent` (`isDirty` in `history.ts`). `open()` and a successful Save project set `saved`; undo back to it is clean again. Export PNG does not clear it. A new, empty document is clean. `markSaved` takes the content as it was when the write started, so a change made during the write stays dirty. `DiscStudio.tsx` follows the document and calls `setUnsavedWork({ save })` or `setUnsavedWork(null)` when the flag flips.
- **Save tells what happened.** `saveProjectToDisk` returns `Promise<boolean>`: true after the file is written, false when the Save dialog was cancelled or the write failed (the error is already in the tool's dialog). The Save project button and the prompt call the same function; the button ignores the answer.
- **Open project asks too (S4).** Opening a project replaces the design, so when Disc Studio has unsaved work, the Open project button and a file Explorer hands over (a double-click of a `.nerd` file) show the same `UnsavedDialog` first: Save writes the file and then opens (a cancelled or failed save stops the open), Don't save opens, Cancel stops. The decision is pure (`engine/openGuard.ts`); the dialog lives in Disc Studio (`useOpenGuard`), so the shell is unchanged. The button asks before the file picker opens.
- **What Voucher must do** (it is built on `feat/voucher`):
  1. Take `setUnsavedWork` from its `ToolContext` props. If it never holds work worth keeping, it does nothing and is never asked.
  2. While it holds such work (for example a generated batch not yet written to disk), call `setUnsavedWork({ save })`; call `setUnsavedWork(null)` once it is safe. Call it from an effect on the dirty flag, not on every render.
  3. `save()` resolves true only when the work is on disk, false when the user cancelled a dialog or the save failed, after showing its own error. It never throws.
  4. Its popups are `src/ui/Dialog.tsx` dialogs (then Escape closes them first, for free). If it handles Escape for anything else, it calls `event.preventDefault()`.
  5. Its key listeners act only while it is on screen (`closest("[hidden]") === null`, as `DiscStudio.tsx` does) and use the guards in `src/lib/keyTargets.ts`. It never listens for mouse buttons 3 and 4.
  6. After this branch merges, `feat/voucher` rebases; the only expected conflict is `src/app/App.tsx`.

## Progress

(One line per slice: what landed, what was decided, what the next slice must know.)

- **S1.1** (done): Tauri 2 + React + Vite scaffold, registry (`TOOLS`, `getTool`, `resolveToolForFile`) with tests, placeholder tools, gate on section 8 without `disc-parity`. Decisions: `typescript` is pinned `~6.0.3` because typescript-eslint 8 does not support TypeScript 7 (native compiler, no JS API); `.nerd` is not matched by `resolveToolForFile` (it routes by the `tool` field through `getTool`, which throws on an unknown id), so S2.5 catches that throw for its error dialog; Disc Studio lists only `.disc.json` as a file type; `.prettierignore` skips the kit-managed files (`/tools`, `/CLAUDE.md`, `/.githooks`), which Prettier would otherwise reformat; the default `tauri init` icons stay until S1.3. Next slice: the tool components are one-line placeholders, `App.tsx` shows one tool at a time (S1.2 keeps opened tools mounted), `isTauri()` in `src/lib/platform.ts` is not used yet.
- **S1.2** (done): retro shell and home grid. Tokens, base and fonts in `src/styles/`; shared pieces in `src/ui/` (RetroWindow with RetroTitleBar, Button, Field, NumberField, ColorField, Select, Checkbox, Dialog, ProgressBar, SectionHeader; styles in `src/ui/retro.css`); shell in `src/app/` (TitleBar, StatusBar, HomeGrid, App); window calls in `src/lib/platform.ts` (`windowControls`, `appVersionLabel`). Decisions: (1) Andrei's follow-up: the shell bar is always Nerd Castle royal purple (`--brand-purple` #4a265a, `--on-brand` #f5f5f5, from DESIGN.md), and each tool has its own pastel bar under it inside the tool view, so the plan's "title bar takes the tool colour" is now that tool bar, and the home screen has no yellow bar. (2) Fonts are committed woff2 files with the OFL licences in `src/assets/fonts/`, not `@fontsource` dependencies: the package's per-subset CSS has no `unicode-range`, so latin and latin-ext would clash; we write our own `@font-face` blocks (Plex Mono 400/600/700, Inter 400/500/600/700, latin and latin-ext). (3) Opened tools stay mounted (`hidden`), each with a stable `setStatus`. (4) `openRequest` is still always null (S2.5 wires it). Verified in the real window: tile click, drag, maximise button, double-click restore, minimise, close, version label from `getVersion()`. Next slice: UpdatePrompt can use `Dialog` and `ProgressBar` as they are; only the four window permissions are in the capability file so far.
- **S1.3** (done): per-user NSIS installer (`bundle.targets ["nsis"]`, `installMode currentUser`, `createUpdaterArtifacts true`), `tauri-plugin-updater` and `-process` (capabilities `updater:default`, `process:allow-restart`), update check on start in `src/app/update/` (`updateCheck.ts` logic with a fake-checker test, `progress.ts` with test, `useUpdates.ts`, `UpdatePrompt.tsx`), release and CI workflows in `.github/workflows/`, `tauri.unsigned.conf.json` plus `build:unsigned` for local builds without the key. Added on Andrei request: a gear button at the left of the status bar opens a Settings window (`src/app/settings/`: data-driven `SETTINGS_SECTIONS` with About, Updates and an empty Shopify connection placeholder; S3.2 adds a section by writing a component and one array line). `Dialog` now accepts `colour="brand"` and prevents the native Escape close so the parent decides. Decisions: the start check is skipped in dev and in a plain browser, a failure shows only "Update check failed (offline?)" in the status bar; actions pinned to exact versions (tauri-action v1.0.0, uses `updaterJsonPreferNsis`); CI installs gitleaks v8.30.1 so the full gate runs there. Not done: `scripts/release-tag.mjs` + test, `docs/releasing.md`, `src-tauri/icons/source.svg` (default icons stay), README install section, because the S1.3 brief did not list them. Cargo.toml keeps version 0.0.0 (tauri.conf.json reads package.json). Next slice: `src/app/settings/sections.tsx` and `SettingsContext` are the place for new app-wide settings.
- **C1** (done 2026-11-18): the history scan found only the Windows username in one plan path; it was rewritten out of all commits before the push. Local backup `D:\Backups\nerds-workbench-legacy.bundle`. The old repo is now private `NerdsWorkbench-legacy` (PR #1, `master`, `chore/python-stack`); an extra private copy `NerdsWorkbench-mirror-2026-11-18` waits for Andrei to delete it (the gh token has no `delete_repo` scope). New public `RedGuyFromHell/NerdsWorkbench`, `main` only; remotes `origin` (new) and `legacy`. CI green on GitHub. v0.5.0 first failed at signing (wrong password secret; Andrei reset it, then `gh run rerun --failed` on the same tag worked). Andrei installed v0.5.0: no admin prompt; SmartScreen asks "Run anyway" (no code signing, by decision). v0.5.1 (version bump only) was offered on start, Update now worked, the app came back as 0.5.1. Trap: PowerShell 5.1 `Set-Content -Encoding utf8` writes a BOM and breaks `package.json`; edit it with an editor or the Edit tool. Not done from the plan's S1.3 list: `scripts/release-tag.mjs`, `docs/releasing.md`, our own app icon, README install section.
- **S2.1** (done): the six pure engine modules in `src/tools/disc-studio/engine/` (`geometry`, `maskAlpha`, `pngDpi`, `project`, `svg`, `layerOps`) with 102 tests, each proven by breaking the code by hand; `happy-dom` added as a dev dependency, used only by `svg.test.ts`. Decisions: (1) the engine returns new values and never mutates (the HTML mutates in place), so S2.3's store replaces a layer or stroke instead of editing it; `addStrokePoint` returns the same stroke when the point is thinned out. (2) `project.ts` is the home of the types (`Layer` = `ImageLayer | TextLayer`, `Stroke`, `DiscSettings`, `DiscProject`); in memory the settings are `settings`, in the file they stay `S`. `serializeProject` writes `tool` and `version` (the `.nerd` wrapper) and also the HTML's `app` and `v`, so the HTML can still open the file; `parseProject` takes a file when `tool` or `app` says `disc-studio`, accepts version 1 only, and throws "Not a Disc Studio project." otherwise. (3) Canvas-bound work stays for S2.2: `layerBox` takes a `BoxSource` (image height/width and `measureLine(layer, line)` at font size `TEXT_MEASURE_SCALE` = 10) so `render.ts` supplies the real measuring; the layer transform, the eraser canvas, the compose order and `buildMasks` drawing are not here. `builtinMaskRadii` and `cutRadii` return pixel radii where inner 0 means no ring. (4) `nextLayerId` ignores an image id that is not `i` plus a number (the HTML would give NaN). Next slice: S2.2 builds `document.ts` and `render.ts` on these; `bandArcPath(settings)` returns the path string for `destination-out` or null with no band.
- **S2.2** (done): `engine/document.ts` (`DiscDocument`: settings, layers, images, mask, selection, tool, brush, hover, `subscribe`, `getVersion`, `markChanged`, `requestDraw` with rAF coalescing, async `open(project)`) and `engine/render.ts` (`DiscRenderer`: `buildMasks`, `compose`, `draw(withSelection)`, `boxOf`, plus `fontString`) on the S2.1 modules. Parity harness in `tests/disc-parity/` (unchanged `reference/disc-studio.html`, `parity.html` + `parity-entry.ts`, `reference-entry.ts`, `fixtures.ts`, `capture.ts`, `parity.spec.ts`, root `playwright.config.ts`, Vite on port 1421): 12 fixtures, print and view canvas compared byte for byte, no tolerance, all identical on the first run; mutation checks (image shifted 1 px, text baseline, blur, tint alpha, dash lengths, mask ramp) each turn it red. Gate step `disc-parity` added before `secrets`. Decisions: (1) `DiscDocument` owns its `DiscRenderer` and is built from the view canvas (`new DiscDocument(canvas)`); the renderer reads the document, so S2.3 mutates `document.settings`, `layers`, `selected`, `tool`, `hover`, `brushMm`, then calls `markChanged()` (panels and redraw) and, after a mask-affecting setting changes, `renderer.buildMasks()`. (2) `open` loads everything first and assigns after, so a failed image leaves the open project as it was. (3) Fonts: `src/styles/disc-fonts.css` holds Cinzel 400/700, Cinzel Decorative 700 and Bebas Neue 400 (latin and latin-ext, files and OFL licences in `src/assets/fonts/`); Inter comes from `fonts.css`. Whoever builds the Disc Studio screen imports both. (4) `tsconfig.json` now includes `tests` and `playwright.config.ts` and has the `node` types; ESLint lints them too. Next slice: not covered by parity yet: settings-change redraws, pointer code, `addText`/`addImage`, `fontString` for text added by the user (call `document.fonts.load(fontString(layer, TEXT_MEASURE_SCALE))` then `requestDraw`, as the HTML's `addText` does).
- **S2.3** (done): the Disc Studio screen: `DiscStudio.tsx` (three columns, drop handlers on the whole screen, `attachPointer` on the canvas), `panels/` (`DiscSettings`, `AddPanel`, `LayerList`, `LayerProperties`), `useDocumentVersion.ts`, `disc-studio.css`, and engine `pointer.ts` (pointer to mm, drag, wheel step, move-tool listeners), `addLayer.ts` (what a new text or image layer starts with, the low-DPI message, which files are images) and `actions.ts` (select, edit, reorder, duplicate, delete, settings, add; each mutates then calls `markChanged` once), with 30 new tests (each proven by breaking the code). Also: `settingNeedsMaskRebuild` in `project.ts`; `layerBox` now computes `w * nh / nw` through `BoxSource.imageNaturalSize` (parity stays green); `tests/disc-parity/reference/*` is `-text` in `.gitattributes`; the shared UI gained `TextArea` and a `boxOnly` Checkbox. Decisions: (1) layers are replaced, not edited (`replaceLayer` swaps the object and keeps `document.selected` pointing at the new one); (2) panels re-render on every `markChanged` (also during a drag), which is cheap; (3) a drop anywhere on the screen adds images, the low-DPI warning and file errors go to `setStatus` (no alert); (4) the mask type offers Built-in and None only until an uploaded mask exists; (5) DPI is limited to 1-1200 and diameter to at least 1 in the fields, because a canvas of 0 pixels throws; (6) the canvas box has an outline, not a border, so `getBoundingClientRect` maps the pointer exactly. Checked in Edge through Playwright against Vite: text and a dropped PNG land as layers, drag, wheel resize and Shift+wheel rotate redraw the canvas and the panels, Copy works, the page does not scroll at 1100 x 720 or 1920 x 1080. Next slice: `pointer.ts` returns early when `tool` is not "move" in `onPointerDown` and `onPointerMove` (that is where the eraser goes; `hover` is already set), and the wheel for the brush size goes in `onWheel`; keys, Open/Save/Export, the mask upload button and the Project and Export sections of the HTML's side columns are still to build.
- **S2.4** (done): the eraser, shortcuts, native dialogs and export. Rust: `src-tauri/src/files.rs` (`read_file_bytes` returns a raw `Response`; `write_file_bytes` takes `tauri::ipc::Request`, matches `InvokeBody::Raw`, and reads the target path from the `x-file-path` header, percent-encoded by `encodePathHeader`, decoded by our own `percent_decode` with 6 cargo tests), `tauri-plugin-dialog` 2.8.4 and `@tauri-apps/plugin-dialog` 2.8.4, capability `dialog:default` only. TS: `src/lib/files.ts` (`readFileBytes`, `writeFileBytes`, `pickOpenFile`, `pickOpenFiles`, `pickSaveFile`, `safeFileName`; in a plain browser every call throws "Files can only be opened and saved in the desktop app."), engine `keys.ts` (`keyCommand`, `isTypingTarget`), `toolActions.ts` (tool, brush, strokes, `runKeyCommand`), `fileActions.ts` (`*FromDisk` buttons that ask for a path, and `openProjectAt`, `saveProjectAt`, `exportPngAt` that take one), `pointer.ts` (eraser strokes, brush wheel, `attachKeys`), layer ops `appendStroke`, `replaceLastStroke`, `undoStroke`, `clearStrokes`, `nudgeLayer`, panels `ToolPanel`, `ProjectPanel`, `ExportPanel`, Upload mask and Add image buttons, Clear eraser in the layer properties, and `DiscDocument.soft`, `.view` and `.toProject()`. New tests for strokes, nudge, keys, the brush wheel, the path header and file names (each seen red first), and 6 cargo tests, plus a save-and-reopen parity test (8 fixtures, byte for byte). Decisions: (1) `addImageFiles` now takes a `FileUi` (`status` and `error`) instead of one report function: a file error goes to the retro Dialog, the low-DPI warning to the status bar; (2) the keys also stay quiet inside any `<dialog>` (the HTML only guarded fields), and only while the tool is not under a `[hidden]` host; (3) tool buttons read Move, Eraser, Restore with the key in the tooltip and a hint, because the three labels with (V) did not fit the 300 px column; (4) `.disc-buttons` wraps. Checked in the real window (`tauri dev` plus Playwright over the WebView2 debug port, see `docs/learning-tauri.md`): a 1.5 MB raw round trip with a path holding spaces, `ș ț # %`; save, reopen and compare the canvas; PNG pHYs at 600 dpi; an HTML-saved `.disc.json` opens. Only a human can check the native Windows dialogs themselves (the page cannot drive or fake them). Next slice (S2.5): `openProjectAt(doc, path)` in `fileActions.ts` is what a double-clicked `.nerd` should call; `parseProject` throws "Not a Disc Studio project." for another tool, which `getTool` in the registry turns into a throw S2.5 must catch for its dialog.
- **S2.5** (done): `.nerd` association and single instance, version 0.6.0. `bundle.fileAssociations` for `nerd` (one generic name, role Editor); `src-tauri/src/open_files.rs` (`paths_from_args` with 6 cargo tests, `PendingOpenFiles` managed queue, `take_pending_open_files`, the payload-free `open-file` event); `tauri-plugin-single-instance` 2.5.5 registered first in `lib.rs` (the 3.x line is alpha), its callback queues the second launch's argv and unminimises and focuses `main`; the first launch's own argv is queued in `setup`. TS: `src/app/routeOpenFile.ts` (pure, 8 tests: `.nerd` by its `tool` field, `.disc.json` by extension through the registry, else a message), `src/app/openFiles.ts` (`useOpenFiles`: listen, then take the queue, sequentially), `App.tsx` holds an `OpenRequest` per tool (nonce counter) and a retro Dialog for errors, `DiscStudio.tsx` opens `openRequest.path` through the new `openProjectFromPath` when its nonce is new. `docs/releasing.md` now says what the installer registers. Decisions: the event carries no paths, the queue is the only source, so nothing is lost before the page listens and nothing opens twice; no capability change (`core:default` covers `listen`, and our commands need no entry). Not verified by a human yet: the double-click with the app closed and with it open, and the installer's registry entries after a real install. Next slice: S2.5 closes chunk 2; a second tool (Voucher) opens a `.nerd` the same way by setting `openRequest` in its component.
- **Review fixes** (done, chunk 2): the review findings. `NumberField` no longer resets while typing: it reports a number only when it is inside `[min, max]` as it is typed, and clamps on blur or Enter (pure `src/ui/numberInput.ts`, tested). `engine/colours.ts` holds every canvas and default colour, named, with the parity reason. `PROJECT_EXTENSION` lives once in `src/lib/files.ts`; `isToolId` replaces the string cast in `routeOpenFile`; `loadImageFile` replaces the twin load in `actions.ts`; `roundToHundredths` moved to `engine/geometry.ts`; `draw` and the guide `circle` take an options object; the avif filter, the empty-state text and the slice ids in comments are fixed. Decision: `min={0}` stays on hole, bleed, margin, band, curve, size and width (a negative makes no sense there); only the brush has a real floor (0.2), and typing "0" on the way to "0.5" no longer resets it. Next slice: none in chunk 2; Voucher opens a `.nerd` through `openRequest` as before.
- **0.6.1 fix** (done): Save project and both exports failed in the installed 0.6.0 with "The file bytes must be sent as a raw body". The CSP had no `connect-src`, so the built app blocked the IPC fetch to `http://ipc.localhost` and Tauri fell back to postMessage, which sends only JSON. `tauri dev` has no CSP, so the slices did not see it. Fix: `connect-src 'self' ipc: http://ipc.localhost`; `src/lib/csp.test.ts` guards it. Checked on a release build through the WebView2 debug port: the write failed before the fix and wrote the same bytes after it (12 bytes and 5 MB).
- **0.6.2 S1** (done): undo and redo for every Disc Studio change (section 17.1). Pure `engine/history.ts` (snapshots, `recordChange`, `undo`, `redo`, gestures) with 34 tests; `DiscDocument.markChanged` records, `undo()` and `redo()` restore; `attachPointer` opens and closes a gesture around each drag and stroke. `isTypingTarget` moved to `src/lib/keyTargets.ts` with `isTextEntryTarget` and `isInsideDialog`; `ignoresKey` in `keys.ts` keeps undo and redo alive on a select or checkbox. The stroke-only Ctrl+Z, `undoLastStroke` and `undoStroke` are gone. S2 imports `isTypingTarget` and `isInsideDialog` from `src/lib/keyTargets.ts`; S3 can build `isDirty` on `sameContent` and the committed snapshot in `history.ts` (`History.present`).
- **0.6.2 S2** (done): mouse Back and Forward and Escape in the shell (section 17.2). Pure `src/app/screenHistory.ts` (`visit`, `back`, `forward`, cap 50), pure `src/app/shellInput.ts` (`sideButtonDirection`, `leavesToolOnKey`), the hook `src/app/useShellNavigation.ts` (capture-phase listeners on `window`, attached once), 17 new tests, `App.tsx` holds the history and gives the hook `goHome` and `move`. Decisions: the hook also stops `pointerdown` and `pointerup` of the side buttons, or a press over the Disc Studio canvas would start a drag; mouse buttons are ignored while a `dialog[open]` exists. Checked through CDP (`Input.dispatchMouseEvent` back and forward) in `tauri dev` and in a release build, 21 checks each: `history.length` 1, no reload, no pointerdown on the canvas from a side button, Escape home, Escape closes Settings first and stays on the tool, Escape does nothing in a text box or on a `select`. The update prompt and the open-error dialog were not opened (a bare injected `dialog` stood in; they share `Dialog`). A real mouse on the built app is still owed. S3 puts the unsaved-work check inside `goHome` and `move` in `App.tsx` and `openTool` stays as it is: it only adds a screen. The Voucher tool must `preventDefault` a key it wants for itself, Escape included.
- **0.6.2 S3** (done): unsaved-work prompt on every exit, version 0.6.2 (section 17.3). Pure `src/app/exitGuard.ts` (`planExit`, `askNext`, `nextExitStep`) with 15 tests, `useExitGuard` (the tools' work in a ref, one `requestExit(exit, proceed)`, the dialog state), `UnsavedDialog`, `useCloseGuard` (`onCloseRequested`, async-listen guard, `try/catch` that destroys) and `onWindowCloseRequested` and `windowControls.destroy` in `platform.ts`; capability `core:window:allow-destroy`; `ToolContext.setUnsavedWork`. Disc Studio: `isDirty` in `history.ts` (4 tests), `DiscDocument.isDirty`, `committed` and `markSaved(content)`, `saveProjectToDisk` returns a boolean (3 tests with the file calls mocked), `DiscStudio.tsx` reports the flag. "Update now" asks first (`UpdatePrompt` takes `beforeInstall`). Decisions: (1) `useShellNavigation` now calls `preventDefault` on the Escape that goes home: the dialog opens inside that keydown and the browser applied the same Escape to it, so it closed at once (found on the release build). (2) The plan said "Forward brings you back" after Don't save; going home with the HOME button adds a screen, so Forward has nothing and Back (or the tile) returns to the work. (3) `openTool` is not an exit, so opening a file for a tool whose work is unsaved does not ask. Checked on a release build (`tauri build --no-bundle`, WebView2 debug port, the close raised through `plugin:window|close`): clean close at once; dirty close shows the dialog and the window stays; Cancel, Escape in the dialog and Don't save; HOME, Escape and mouse Back each ask, Cancel stays, Don't save leaves with the work still in the hidden tool; a close from home brings the tool on screen first; undo to the opened state and a file opened with the exe argument close with no prompt; a change after open asks. Not checkable by a script (human, on the built app): the native Save dialog (Save, then cancel it: the app must stay on the tool, still dirty), a failed save (read-only folder), Alt+F4 and the taskbar close, "Update now" with a dirty tool, and Save project followed by X closing with no prompt. The Voucher session takes the contract of 17.3 and rebases (the only conflict is `App.tsx`).
- **0.6.2 S4** (done): review findings. A lost pointer capture ends a drag or stroke (`lostpointercapture`), undo and redo do nothing while a gesture is open, `markSaved` seals the undo history; Open project and a handed-over `.nerd` file ask about unsaved work (section 17.3, pure `engine/openGuard.ts`, hook `useOpenGuard`); `useExitGuard` resets `asking` in a `finally` and warns when an exit request arrives while the prompt is open; the silent catches in `useCloseGuard` and `useExitGuard` now `console.warn`; named constants for the mouse buttons; `saved` renamed `runSave`. New tests: pointer gestures (4), document history (3), `sealHistory` (3), `openGuard` (6). The `asking` fix has no test: the hook needs a React renderer and the repo has none. Human check owed: the native Open dialog after Don't save or Save. A real-mouse drag whose capture is lost was not driven by a script.
- **S3.1** (done): the voucher decisions as tested TypeScript, no UI: `core/` has `codeGen` (the 13 Python cases plus two boundary cases; randomness injected, default is `crypto.getRandomValues`), `codeLayout` (per-glyph x, floored centre and baseline), `selection` (draw, move, resize by corner, `toFractions`, `toImagePixels`), `outputFile` (JPG 0.95 for .jpg/.jpeg, else PNG; the file name is the code plus the extension), `generateGuard` (`checkCanGenerate`, the four reasons in order), and a shared `roundHalfToEven`; `shopify/` has `discountInput` (`buildDiscountInput`, `buildDiscountTitle`, `formatMinimumSubtotal`), `collections` (`mergeCollectionPages`) and `codeBatches` (`planCodeBatches`, `BULK_ADD_CODE_LIMIT` = 250, the first code goes to the create call). Rounding decisions: pixel normalisation uses banker's rounding (Python `round`); centre and baseline floor (Python `//`); the minimum subtotal string rounds an exact half cent to even (Python format) and otherwise uses `toFixed(2)`; collection titles sort by lower-cased character code, not `localeCompare`. Ported as the Python behaves, flagged for the screen: (1) "specific collections" with none picked builds an all-products discount, so S3.3 or S3.4 must block it; (2) a resize drag past the left or top edge moves the opposite edge, because the size is worked out before the clamp (pinned by two tests; fix it by changing those tests on purpose); (3) the preview drew without the floor, so S3.3 should use `layoutCode` for both. Next slice: S3.2 and S3.3 import types `Rect`, `Point`, `Corner` from `core/selection.ts` and `Collection` from `shopify/collections.ts`; `generateCodes` throws "Pool too small" which the screen shows; the page cursor loop for collections stays in S3.2's client.
- **S3.2** (done): the app-wide Shopify connection. Rust: `secrets.rs` (trait `SecretStore`, `CredentialManager` on `keyring` 4.2, service `nerds-workbench`, entries `shopify-token` and `shopify-client-secret`; commands `save_client_secret`, `disconnect`), `settings.rs` (`settings.json` in the app config dir with `shopifyStore`, `shopifyClientId`, `apiVersion`; `is_shopify_store`; the one-time import of `~/.nerdworkbench/config.json`, run in `setup` and kept as managed `OldConfigImport`; commands `shopify_status`, `save_shopify_settings`), `shopify/oauth.rs` (`shopify_connect`: state, listeners on 127.0.0.1 and ::1 port 8765, `parse_callback`, token exchange), `shopify/graphql.rs` (`shopify_graphql(query, variables)`), `shopify/mod.rs` (the HTTPS client: no redirects, HTTPS only). New crates: `keyring`, `tauri-plugin-opener` 2.7.3 (called from Rust only, no capability entry), `reqwest` and `rustls` (the versions the updater already builds), `url`, `getrandom`, `hmac`, `sha2`, dev `tempfile`. TS: `src/lib/shopify/client.ts` (`getShopifyStatus`, `connectShopify`, `disconnectShopify`, `shopifyGraphql(query, variables, zodSchema)`, `subscribeToShopifyStatus`, `SHOPIFY_SETTINGS_SECTION`), `useShopifyStatus.ts`, `src/app/settings/ShopifySection.tsx`, `src/tools/voucher/shopify/listCollections.ts` (cursor loop, 5 tests), `VoucherTool.tsx` (not connected, or the collection list). 35 new cargo tests, each security rule seen red with the bug put back. Decisions: (1) the callback is checked in this order: `error` (believed unchecked, it can only end the attempt), `state` (exact), Shopify's `hmac` over the raw query (verified, constant time), `shop` equals the store in Settings, `code` present; the code is only ever exchanged at the store in Settings. (2) One callback, good or bad, closes the listener; other paths get 404 and the wait goes on; 120 s timeout. (3) Error strings hold the HTTP status and Shopify's GraphQL messages only: no response body from the token exchange, no reqwest error text (it carries the URL), no serde text for the old config, and the token is cut out of a GraphQL error by force. (4) There is no `has_token` command: `shopify_status` answers it together with the rest. (5) No default store in the code (public repo): the user types it, or the import brings it. (6) Changing the store deletes the token. (7) `listCollections` lives in the voucher folder and takes the GraphQL call as a parameter, so `src/lib` does not import from a tool. (8) `ToolContext` gained `openSettings(sectionId)`; `SettingsWindow` takes `focusSectionId`; `Field` takes `type="password"`; a tall Dialog now scrolls inside. Not verified here, on purpose: nothing ran against Windows Credential Manager, the real old config file or Shopify. The live connect is the first proof of the hmac message format and of the keyring calls. Next slice: S3.3 replaces the body of `VoucherTool.tsx` but keeps the not-connected state; call `listCollections()` for the picker and `shopifyGraphql` with a zod schema for anything else; a failed call rejects with an `Error` whose message is ready to show.
