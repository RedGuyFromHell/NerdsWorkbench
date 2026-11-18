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

The page cannot touch the disk or the system by itself. A Tauri command is a Rust function marked `#[tauri::command]` and registered in the builder; the page calls it with `invoke("name", { args })`, which returns a promise, a bit like calling a method across a process boundary. Our first commands are the two file ones in `src-tauri/src/files.rs`, registered with `generate_handler!` in `lib.rs`; `src/lib/files.ts` wraps them. `src/lib/platform.ts` tells the UI whether it runs in the Tauri window or in a plain browser, and the file wrappers throw one clear error in a browser.
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

## useSyncExternalStore: React reading a store that is not React's

The Disc Studio document is a plain TypeScript object that changes in place, dozens of times a second while you drag a layer. React does not know about it, so each panel calls `useDocumentVersion`, which is `useSyncExternalStore(doc.subscribe, doc.getVersion)`: React calls `subscribe` once to be told when something changed, and asks `getVersion` for a number; when the number differs from the last one, it renders the panel again, and the panel reads the layers straight off the document. It is like a C# `INotifyPropertyChanged` event plus a version counter, instead of copying every layer into React state (a copy that could drift from the real one).
See `src/tools/disc-studio/useDocumentVersion.ts:6`.

## requestAnimationFrame: draw once per frame, never from a render

The canvas is not drawn by React. `DiscDocument.requestDraw()` asks the browser for a callback before the next screen frame (`requestAnimationFrame`) and ignores further calls until that frame has run, so ten pointer moves in one frame cost one drawing. It is like marking a Unity object dirty and letting the frame loop redraw it, not calling `Draw()` on every input event. React re-renders only the small panels; the expensive canvas work stays outside it.
See `src/tools/disc-studio/engine/document.ts:69`.

## HTML5 file drop with dragDropEnabled false

Tauri can catch a dropped file itself and give the app a list of paths. We turned that off (`dragDropEnabled: false` in `tauri.conf.json`), so the webview behaves like a normal web page: a drop reaches our `onDrop` handler as a browser `File` object whose bytes we read with `FileReader` or `file.text()`, exactly like the original HTML did. The handler must call `preventDefault` on `dragover` and on `drop`, or the browser would open the file in the window instead.
See `src/tools/disc-studio/DiscStudio.tsx:52`.

## A wheel listener that can stop the scroll

Browsers treat a `wheel` listener as passive: it may not call `preventDefault`, so the page can scroll smoothly without waiting for the handler. React's `onWheel` is passive, so the canvas listener is added by hand with `addEventListener("wheel", handler, { passive: false })`, and removed again in the cleanup function that `attachPointer` returns (the same idea as unsubscribing a C# event handler in `Dispose`).
See `src/tools/disc-studio/engine/pointer.ts:140`.

## Raw IPC bodies: sending bytes without a number array

`invoke("cmd", { args })` sends JSON. A file as JSON is a list of numbers, roughly ten times the size, and slow to build. A command can instead take the whole request: in Rust `write_file_bytes(request: tauri::ipc::Request)` matches `request.body()` against `InvokeBody::Raw(bytes)`, and in the page the second argument of `invoke` is the bytes themselves (a `Uint8Array`), with the options as the third. The other way, a command that returns `tauri::ipc::Response::new(bytes)` gives the page an `ArrayBuffer`. A 1.5 MB round trip works in the real window. A raw body has no named arguments, so anything else the command needs (here the path) travels in a request header.
See `src-tauri/src/files.rs:52`.

## A path in an HTTP header: percent-encoding

Header values are ASCII, and a path can hold spaces, `ș`, `ț`, `#` and `%`. The page writes the path with `encodeURIComponent` (every unsafe byte becomes `%XX` of its UTF-8) and Rust undoes it in `percent_decode`, which accepts only two hex digits after a `%` and demands valid UTF-8. A `%` in the path itself becomes `%25`, so it round-trips. `src/lib/files.test.ts` and the cargo tests pin both sides with the same examples.
See `src/lib/files.ts:31`.

## Capabilities for the dialogs, and why not the fs plugin

The dialog plugin (`tauri-plugin-dialog`, `@tauri-apps/plugin-dialog`) shows the Windows Open and Save windows, and the page may only call it if the capability file lists `dialog:default`. Our own commands need no entry: a command registered in `generate_handler!` is open to every window of the app. We read and write with two small commands instead of `tauri-plugin-fs` because the fs plugin limits the paths a page may touch by scope, and a path the user picked in an earlier session or on another drive can fall outside it.
See `src-tauri/capabilities/default.json:14`.

## Checking the real window from a script: the WebView2 debug port

`tauri dev` runs the page in WebView2, which is Edge. Start it with the environment variable `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222` (and `WEBVIEW2_USER_DATA_FOLDER` pointing at a scratch folder, or WebView2 refuses to start next to another app that uses the default one), and Playwright can attach with `chromium.connectOverCDP("http://localhost:9222")`. Inside the page, `await import("/src/lib/files.ts")` loads the same module the app uses from Vite, so a script can call the real commands with the real IPC and check the file with Node. Native dialogs cannot be driven this way: `window.__TAURI_INTERNALS__.invoke` is read-only, so it cannot be faked, and a click on a dialog button opens a real dialog.
See `src/tools/disc-studio/engine/fileActions.ts:85`.

## Command-line arguments: how Explorer hands a file to the app

Double-clicking a file with an associated extension runs `app.exe "C:pathile.nerd"`: the path is just an argument after the executable's own name. `std::env::args()` lists them, so `paths_from_args` skips the first one and anything starting with `-`. A path with spaces or `ș` arrives as one whole argument, because Windows quotes it. `bundle.fileAssociations` only tells the installer to register the extension; the app itself must read its arguments.
See `src-tauri/src/open_files.rs:18`.

## Single instance: the second launch talks to the first

Without help, every double-click starts another copy. `tauri-plugin-single-instance` lets the first copy keep running: a second launch exits at once and calls a callback **in the first copy** with its arguments and working folder. Our callback queues the paths and brings the window to the front (`unminimize`, `show`, `set_focus`). The plugin must be registered before every other plugin, so the second launch dies before it opens anything.
See `src-tauri/src/lib.rs:15`.

## Managed state: data shared by commands

`Builder::manage(value)` puts one value in the app for good; a command asks for it with a parameter `State<'_, T>` and Tauri fills it in. Commands run on several threads, so a value that changes sits behind a `Mutex`. Ours is the queue of paths waiting for the page (`PendingOpenFiles`), and `take_pending_open_files` empties it with `std::mem::take`.
See `src-tauri/src/open_files.rs:43`.

## Events: Rust tells the page, and the race with the first render

`app.emit("open-file", ())` sends an event to the page, which hears it with `listen` from `@tauri-apps/api/event` (the `core:default` capability already allows listening). An event is not stored: one sent before the page called `listen` is gone. So the event carries no data. The paths wait in the queue, and the page takes the queue once when it mounts and again on every event. It listens first, then takes, so a path that arrives in between is still picked up.
See `src/app/openFiles.ts:38`.

## The CSP must allow the IPC protocol, or raw bodies turn into JSON

The page calls Rust with a `fetch` to Tauri's IPC protocol: `http://ipc.localhost` on Windows, `ipc:` on macOS and Linux. The app's Content Security Policy (`app.security.csp`) decides what the page may fetch. If `connect-src` is missing, `default-src 'self'` applies and blocks it. Tauri does not fail: it logs a warning and falls back to `window.ipc.postMessage`, which carries only JSON. Commands with JSON arguments still work, so nothing looks broken, but a raw body (`InvokeBody::Raw`) arrives as JSON and `write_file_bytes` refuses it. `tauri dev` serves the page from Vite without the CSP, so only the built app shows it. Our CSP lists `connect-src 'self' ipc: http://ipc.localhost`, and `src/lib/csp.test.ts` keeps it there.
See `src-tauri/tauri.conf.json:27`.

## The mouse side buttons: button 3 and 4, and why WebView2 may navigate

A mouse with Back and Forward buttons sends them as `button` 3 and 4 in the mouse events (0 left, 1 middle, 2 right). In a browser they go back and forward through the page history, and WebView2 is a browser, so in principle it can do the same inside our window. Our app is one page with no link, route or `pushState`, so its session history holds one entry and `history.length` is 1: there is nowhere to go and nothing happens. We still call `preventDefault` on the side buttons, so a link added later cannot start moving the page by itself. The screens (home, tools) have their own history in `src/app/screenHistory.ts`, and the side buttons walk that.
See `src/app/shellInput.ts:7`.

## Capture-phase listeners on `window`: first in line, before every component

An event travels down from `window` to the target (capture), then back up (bubble). A listener added with `addEventListener(type, fn, true)` on `window` hears the event first, before any React handler or any listener a tool put on its canvas, and `stopPropagation` there hides it from all of them. The Disc Studio canvas starts a drag on every `pointerdown`, whatever the button, so a side button pressed over it would grab a layer; the shell stops `pointerdown` and `pointerup` for button 3 and 4 in the capture phase and the canvas never sees them. `preventDefault` is not used on those two: it would silence the `mousedown` and `mouseup` that follow, and `mouseup` is where the move happens. The listeners are added once in an effect and read the latest actions through a ref, so they are not rebuilt on every render.
See `src/app/useShellNavigation.ts:40`.

## Pressing a side button from a script: CDP `Input.dispatchMouseEvent`

Playwright's `page.mouse` has only left, middle and right. Through the WebView2 debug port a script can open a raw Chrome DevTools Protocol session (`context.newCDPSession(page)`) and send `Input.dispatchMouseEvent` with `button: "back"` or `"forward"`, once as `mousePressed` and once as `mouseReleased` (with `buttons` 8 or 16 while pressed). The browser turns it into the same trusted events a real mouse makes, so a check of the built app can press the side buttons without moving the real mouse. A real mouse on the real window is still the final proof.
