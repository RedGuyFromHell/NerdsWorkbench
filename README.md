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

`node tools/check.mjs` runs every check: Prettier, ESLint, rustfmt, gitleaks, `tsc`, Vitest, the Vite build, clippy and the Rust tests. `--fast` runs the quick ones (this is what the pre-commit hook runs) and `--only <name>` runs one. The steps are listed in `check.config.json`. Never commit with `--no-verify`.

## Layout

- `src/app/`: the shell (home grid, tool view).
- `src/tools/`: one folder per tool, plus `registry.ts`, the list of tools. Adding a tool is a folder and one line in `TOOLS`.
- `src/lib/`: helpers shared by the shell and the tools.
- `src-tauri/`: the Rust side and the Tauri config.
- `docs/`: the plan (`plan-workbench-1.0.md`) and the learning notes (`learning-tauri.md`).

## Project files

A project file is JSON with a top-level `"tool"` field and a `"version"` field, and the extension `.nerd`. The app opens it in the tool named by `"tool"`, not by the extension. Old Disc Studio files end in `.disc.json` and open in Disc Studio by their extension.
