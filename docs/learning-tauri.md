# Learning Tauri

Notes for Andrei, who knows C#/Unity and front-end but not Rust or Tauri. Each slice adds a few entries.

## What `src-tauri/` and `tauri.conf.json` are

A Tauri app is two programs glued together. The UI is a normal web page (here React, built by Vite). Around it sits a small native program written in Rust, which opens the window and shows the page inside Windows' own web view (WebView2, the same engine as Edge). Everything Rust-side lives in `src-tauri/`. `tauri.conf.json` is its settings file: the app name, the window size, what the page is allowed to load (the CSP), and where the built page is (`frontendDist`) or served from during development (`devUrl`). Think of it as the Unity Player Settings, as a file.
See `src-tauri/tauri.conf.json:1`.

## What Cargo is

Cargo is the Rust tool that does what NuGet plus MSBuild do for C#. `Cargo.toml` lists the project and its crates (Rust packages), and `cargo build` downloads and compiles them all. The first build is slow because Tauri has hundreds of crates; after that only what changed is rebuilt. The folder `src-tauri/target/` holds the build output and is never committed.
See `src-tauri/Cargo.toml:1`.

## How Vite and Tauri dev work together

`corepack pnpm tauri dev` first runs the `beforeDevCommand` from `tauri.conf.json`, which starts the Vite dev server on port 1420. Then it builds the Rust program and opens a window that simply loads `http://localhost:1420`. Edit a React file and the window updates itself, like a normal web page. The port is fixed because the Rust side has it written down, so Vite is told to fail rather than pick another one.
See `vite.config.ts:9`.

## What a Tauri command is, and `invoke`

The page cannot touch the disk or the system by itself. A Tauri command is a Rust function marked `#[tauri::command]` and registered in the builder; the page calls it with `invoke("name", { args })`, which returns a promise, a bit like calling a method across a process boundary. This slice has no commands yet: the next slices add the file ones. Until then `src/lib/platform.ts` tells the UI whether it runs in the Tauri window or in a plain browser.
See `src-tauri/src/lib.rs:1`.

## A custom title bar: `decorations: false` and the drag region

Normally Windows draws the title bar and the three buttons. With `"decorations": false` in `tauri.conf.json` the window has no frame at all, so the page draws its own bar. To make that bar move the window, put the attribute `data-tauri-drag-region` on it. Tauri then drags the window when you press on that element, and a double-click toggles maximise. The attribute only counts on the element you press itself, not its children, so the title text carries it too, while the buttons inside the bar stay normal clickable buttons.
See `src/ui/RetroWindow.tsx:28`.

## Window commands and capabilities

The buttons call `getCurrentWindow().minimize()`, `.toggleMaximize()` and `.close()`. Each one is a Tauri command, and a command is blocked until a **capability** allows it. Capabilities are JSON files in `src-tauri/capabilities/`; ours lists `core:window:allow-minimize`, `allow-toggle-maximize`, `allow-close` and `allow-start-dragging` (the last one is what the drag region needs). A permission with a misspelt name fails the Rust build, which is a handy check. Think of it as an allow-list the page must be on before it can touch the window.
See `src-tauri/capabilities/default.json:6`.

## Bundled fonts and the CSP

The CSP line in `tauri.conf.json` says `font-src 'self' data:`: the page may load fonts only from the app itself, never from Google Fonts. So the woff2 files live in `src/assets/fonts/` and `src/styles/fonts.css` points at them. Vite copies them into the built app, so the app also works with no network. Each font is split in two files (`latin` and `latin-ext`, which holds the Romanian ș and ț) and `unicode-range` makes the web view load only the file a page needs.
See `src/styles/fonts.css:5`.

## Running the UI in a plain browser

`corepack pnpm dev` alone serves the page at http://localhost:1420 without the Rust window. Calls to the window API would fail there, so `src/lib/platform.ts` checks `isTauri()` first and loads the Tauri modules only inside the real window. In a browser the buttons do nothing and the status bar says "web preview", which is enough to check the layout in any browser.
See `src/lib/platform.ts:4`.

## The updater: signing, `latest.json` and the plugins

Self-update has three parts. First, a key pair made once with `tauri signer generate`: the private half signs each release build (it lives in GitHub secrets, never in the repo), the public half sits in `tauri.conf.json` under `plugins.updater.pubkey`, so an installed app can check that an update really comes from us. Second, `bundle.createUpdaterArtifacts: true` makes `tauri build` also write a `.sig` signature file next to the installer. Third, the release workflow publishes the installer, the `.sig` and a small `latest.json` (version, notes, download URL, signature) on a GitHub Release. The `endpoints` URL in the config points at `releases/latest/download/latest.json`, which GitHub always redirects to the newest release. On start, the page calls `check()` from `@tauri-apps/plugin-updater`; it fetches that file, compares versions and, if newer, `downloadAndInstall()` downloads, verifies the signature and runs the installer (`installMode: "passive"` shows a small progress window, no questions). Then `relaunch()` from `@tauri-apps/plugin-process` restarts the app. Lose the private key and no installed copy can ever accept an update again.
See `src/app/update/updateCheck.ts:74`.

## Plugins, capabilities and the per-user installer

A Tauri plugin has two halves that must both be wired: a Rust crate registered in the builder (`tauri_plugin_updater`, `tauri_plugin_process` in `src-tauri/src/lib.rs`) and a JavaScript package the page imports. Its commands are blocked until the capability file allows them: `updater:default` (check, download, install) and `process:allow-restart` (relaunch). The installer itself is NSIS, and `bundle.windows.nsis.installMode: "currentUser"` makes it install under `%LOCALAPPDATA%` instead of Program Files, so there is no admin (UAC) prompt, and the updater can replace the app later without one either.
See `src-tauri/capabilities/default.json:10`.

## zod at the boundary: reading a project file

A file from the disk is just text until we check it. `parseProject` in `src/tools/disc-studio/engine/project.ts` is the one place where that happens: `JSON.parse` gives `unknown`, a **zod** schema checks every field, fills the missing settings with defaults, and returns a typed `DiscProject`. After that the rest of the code trusts the types and checks nothing again, much like deserialising JSON into a C# class once, at the edge. A damaged file fails loudly with the path of the broken field (`layers.0.x`) instead of crashing later in the drawing code. The TypeScript types (`Layer`, `DiscSettings`) are derived from the schema with `z.infer`, so the schema and the types cannot drift apart.
See `src/tools/disc-studio/engine/project.ts:117`.

## happy-dom: a browser DOM for one test file

Vitest runs tests in Node, which has no `document` and no `DOMParser`. Most of our tests need neither, so they run in plain Node (fast). `svg.ts` does need a DOM, so its test file starts with the comment `// @vitest-environment happy-dom`: Vitest then gives only that file a small fake browser from the `happy-dom` package, and every other file keeps the plain environment. It is like putting one test into a different Unity test assembly instead of changing the whole project. happy-dom is not a real browser: it proves our logic, and the pixel-exact drawing is proven separately against the original HTML.
See `src/tools/disc-studio/engine/svg.test.ts:1`.

## WebView2 is Edge, and why the parity test uses the installed Edge

A Tauri window on Windows is a **WebView2** control, which is the Microsoft Edge browser engine (Chromium) embedded in an app, much like a Unity `WebView` or a C# `WebView2` control. So canvas drawing in our app behaves like canvas drawing in Edge. **Playwright** drives a real browser from a test: `channel: "msedge"` in `playwright.config.ts` tells it to start the Edge already installed on the PC instead of downloading its own Chromium, so the test runs on the same engine as the app. The Disc Studio parity test renders the same project through the original HTML and through our code in that Edge and compares every pixel.
See `playwright.config.ts:12`.

## Playwright serves the page through Vite, and routes the fonts

The parity test needs two pages: the original `disc-studio.html` and our own `parity.html`. `webServer` in the Playwright config starts the Vite dev server first (on port 1421, because 1420 belongs to `tauri dev`), so both pages and the TypeScript they import are served by it. The original asks Google Fonts for its fonts; `context.route(...)` catches that request inside the test and answers with our bundled `@font-face` rules, so no test touches the network and both pages draw with the same font files. It is like pointing a C# `HttpClient` at a fake handler in a unit test.
See `tests/disc-parity/parity.spec.ts:15`.

## Why a byte-exact pixel comparison is allowed here

Comparing screenshots usually needs a tolerance, because two machines draw anti-aliased edges a little differently. Here both images come from the same browser process on the same machine in the same minute, so the only thing that can differ is our code. That is why the test accepts zero differing pixels: a difference is a real bug, not noise. The test also checks that the reference print is not empty, because two blank canvases would be equal too.
See `tests/disc-parity/parity.spec.ts:64`.
