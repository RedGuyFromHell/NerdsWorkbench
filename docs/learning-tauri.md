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
