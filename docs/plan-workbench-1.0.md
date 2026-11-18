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
- **The Shopify connection belongs to the Voucher tool** (`src/tools/voucher/shopify/`), not the shell. Only one tool uses it (rule of two). Other tools work with no Shopify set up, unlike today's blocking first-run dialog.

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
        client.ts        # calls the Rust shopify_graphql command, parses with zod
        ConnectPanel.tsx # client id/secret, Connect, status
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

export interface ToolContext {
  openRequest: OpenRequest | null;
  setStatus(text: string): void;
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

Source: `~/Downloads/disc/disc-studio.html (on Andrei's PC)` (629 lines). S2.2 copies it unchanged to `tests/disc-parity/reference/disc-studio.html`; every later brief points at that copy, with line ranges.

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
Goal: in the Voucher tool, the user enters the client ID and secret, clicks Connect, approves in the browser, and the app stores the token in Windows Credential Manager; collections load.
Files:

- New `src-tauri/src/settings.rs`: `settings.json` in the app config dir (store, client id, API version `2026-04` as one named default); one-time import of `~/.nerdworkbench/config.json` (token and secret move to Credential Manager, then the old file is rewritten without those two keys, and the UI says so).
- New `src-tauri/src/secrets.rs`: `keyring` (Windows native), service `nerds-workbench`, entries `shopify-token` and `shopify-client-secret`; commands `save_client_secret`, `has_token`, `disconnect`.
- New `src-tauri/src/shopify/oauth.rs`: listener on `127.0.0.1:8765` and `[::1]:8765` (browsers may resolve `localhost` to either), `/callback` only, 120 s timeout, random `state`, browser opened through `tauri-plugin-opener`, token exchange with `reqwest`, the scopes from README (`read_price_rules,write_price_rules,read_discounts,write_discounts,read_products`). Command `shopify_connect`.
- New `src-tauri/src/shopify/graphql.rs`: command `shopify_graphql(query, variables)`; reads the token from Credential Manager; returns data or an error with the HTTP status and the GraphQL messages, never the token.
- New `src/tools/voucher/shopify/client.ts` (zod parse of every response), `ConnectPanel.tsx`, a settings button in the Voucher tool.
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
- Disc Studio has no "unsaved changes" warning on close (the HTML has none either).

## 16. Slice table

Estimates are the expected end context of each agent, the 1.5x margin included.

| id   | behaviour                                                         | est.              | waits on             | files (main)                                                                                                                 | model                              | status |
| ---- | ----------------------------------------------------------------- | ----------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------ |
| S1.1 | window with home grid from the registry; TS + Rust gate green     | 90k               | prep (section 4)     | package.json, vite/ts/eslint configs, src-tauri/*, src/tools/registry.ts, check.config.json, README                          | Sonnet                             |        |
| S1.2 | retro shell, custom title bar, home grid of icons                 | 100k              | S1.1                 | src/styles/_, src/ui/_, src/app/*, tauri.conf.json, capabilities                                                             | Sonnet                             |        |
| S1.3 | per-user installer, update prompt, release and CI workflows       | 90k               | S1.2, signing key    | tauri.conf.json, lib.rs, src/app/update/_, scripts/release-tag._, .github/workflows/*, docs/releasing.md                     | Sonnet                             |        |
| C1   | repo switch, v0.5.0, v0.5.1 update proven                         | main session ~20k | S1.3                 | git remotes, GitHub                                                                                                          | main session                       |        |
| S2.1 | Disc engine pure modules with tests                               | 85k               | C1                   | src/tools/disc-studio/engine/* (pure)                                                                                        | Sonnet                             |        |
| S2.2 | render port, pixel-identical to the HTML, parity test in the gate | 105k              | S2.1                 | engine/document.ts, engine/render.ts, tests/disc-parity/*, playwright.config.ts, check.config.json                           | Sonnet (Fable medium if stuck)     |        |
| S2.3 | Disc Studio screen: settings, layers, properties, move tool       | 105k              | S2.2                 | src/tools/disc-studio/_.tsx, panels/_, engine/pointer.ts                                                                     | Sonnet                             |        |
| S2.4 | eraser, keys, native dialogs, export                              | 95k               | S2.3                 | src-tauri/src/files.rs, lib.rs, src/lib/files.ts, panels/*, engine/pointer.ts                                                | Sonnet                             |        |
| S2.5 | `.nerd` association and single instance                           | 65k               | S2.4                 | tauri.conf.json, src-tauri/src/open_files.rs, lib.rs, src/app/openFiles.ts                                                   | Sonnet                             |        |
| S3.1 | voucher pure core with tests                                      | 85k               | C1                   | src/tools/voucher/core/*, src/tools/voucher/shopify/{discountInput,collections,codeBatches}.ts                               | Sonnet                             |        |
| S3.2 | Shopify connect: settings, Credential Manager, OAuth, GraphQL     | 110k              | S3.1, chunk 2 merged | src-tauri/src/{settings,secrets}.rs, src-tauri/src/shopify/*, lib.rs, src/tools/voucher/shopify/{client.ts,ConnectPanel.tsx} | Fable medium: security code        |        |
| S3.3 | voucher screen: preview, selection, settings panel, fonts         | 110k              | S3.2                 | src/tools/voucher/*.tsx, core/drawVoucher.ts, src-tauri/src/fonts.rs, lib.rs                                                 | Sonnet                             |        |
| S3.4 | generate run: csv, discount, images; 1.0.0 docs                   | 100k              | S3.3                 | core/generateRun.ts, VoucherTool.tsx, README, docs/releasing.md, package.json                                                | Fable medium: live discount writes |        |

Sum of agent slices: 1,145k (chunk 1: 280k, chunk 2: 455k, chunk 3: 410k). Reviews add about 6 agents of 50k to 70k each, plus the Opus security review.

**Parallel:** S3.1 shares no file with S2.1 to S2.5 and waits only on C1, so it may run beside any chunk 2 slice, on `feat/voucher`. Everything else runs in order: `lib.rs`, `tauri.conf.json`, `capabilities/default.json` and `package.json` are shared hot spots.

## Progress

(One line per slice: what landed, what was decided, what the next slice must know.)

- **S1.1** (done): Tauri 2 + React + Vite scaffold, registry (`TOOLS`, `getTool`, `resolveToolForFile`) with tests, placeholder tools, gate on section 8 without `disc-parity`. Decisions: `typescript` is pinned `~6.0.3` because typescript-eslint 8 does not support TypeScript 7 (native compiler, no JS API); `.nerd` is not matched by `resolveToolForFile` (it routes by the `tool` field through `getTool`, which throws on an unknown id), so S2.5 catches that throw for its error dialog; Disc Studio lists only `.disc.json` as a file type; `.prettierignore` skips the kit-managed files (`/tools`, `/CLAUDE.md`, `/.githooks`), which Prettier would otherwise reformat; the default `tauri init` icons stay until S1.3. Next slice: the tool components are one-line placeholders, `App.tsx` shows one tool at a time (S1.2 keeps opened tools mounted), `isTauri()` in `src/lib/platform.ts` is not used yet.
- **S1.2** (done): retro shell and home grid. Tokens, base and fonts in `src/styles/`; shared pieces in `src/ui/` (RetroWindow with RetroTitleBar, Button, Field, NumberField, ColorField, Select, Checkbox, Dialog, ProgressBar, SectionHeader; styles in `src/ui/retro.css`); shell in `src/app/` (TitleBar, StatusBar, HomeGrid, App); window calls in `src/lib/platform.ts` (`windowControls`, `appVersionLabel`). Decisions: (1) Andrei's follow-up: the shell bar is always Nerd Castle royal purple (`--brand-purple` #4a265a, `--on-brand` #f5f5f5, from DESIGN.md), and each tool has its own pastel bar under it inside the tool view, so the plan's "title bar takes the tool colour" is now that tool bar, and the home screen has no yellow bar. (2) Fonts are committed woff2 files with the OFL licences in `src/assets/fonts/`, not `@fontsource` dependencies: the package's per-subset CSS has no `unicode-range`, so latin and latin-ext would clash; we write our own `@font-face` blocks (Plex Mono 400/600/700, Inter 400/500/600/700, latin and latin-ext). (3) Opened tools stay mounted (`hidden`), each with a stable `setStatus`. (4) `openRequest` is still always null (S2.5 wires it). Verified in the real window: tile click, drag, maximise button, double-click restore, minimise, close, version label from `getVersion()`. Next slice: UpdatePrompt can use `Dialog` and `ProgressBar` as they are; only the four window permissions are in the capability file so far.
