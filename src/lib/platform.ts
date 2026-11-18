// Tells the UI whether it runs inside the Tauri window or in a plain browser (the Vite URL), and
// wraps the few window calls the shell needs. In a plain browser they do nothing, so the layout
// can still be checked there.
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// WHY: the Tauri API modules are imported on demand, so a plain browser never loads them.
async function withCurrentWindow(action: (window: WindowHandle) => Promise<void>): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await action(getCurrentWindow());
}

interface WindowHandle {
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  destroy(): Promise<void>;
}

export const windowControls = {
  minimize: () => withCurrentWindow((window) => window.minimize()),
  toggleMaximize: () => withCurrentWindow((window) => window.toggleMaximize()),
  close: () => withCurrentWindow((window) => window.close()),
  // WHY: close() asks again (it raises a close request); destroy() ends the window for good, for
  // when the close hook has already asked the user.
  destroy: () => withCurrentWindow((window) => window.destroy()),
};

/** What the close hook may do with a close request. */
export interface CloseRequest {
  preventDefault(): void;
}

/**
 * Runs `handler` whenever the window is asked to close (the X button, Alt+F4, the taskbar). Unless
 * the handler calls preventDefault, the window then closes. Resolves to the unlisten function;
 * does nothing in a plain browser.
 */
export async function onWindowCloseRequested(
  handler: (request: CloseRequest) => void | Promise<void>,
): Promise<() => void> {
  if (!isTauri()) return () => {};
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow().onCloseRequested(handler);
}

/** The app version for the status bar: from the app in Tauri, "web preview" in a plain browser. */
export async function appVersionLabel(): Promise<string> {
  if (!isTauri()) return "web preview";
  const { getVersion } = await import("@tauri-apps/api/app");
  return `v${await getVersion()}`;
}
