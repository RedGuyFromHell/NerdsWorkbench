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
}

export const windowControls = {
  minimize: () => withCurrentWindow((window) => window.minimize()),
  toggleMaximize: () => withCurrentWindow((window) => window.toggleMaximize()),
  close: () => withCurrentWindow((window) => window.close()),
};

/** The app version for the status bar: from the app in Tauri, "web preview" in a plain browser. */
export async function appVersionLabel(): Promise<string> {
  if (!isTauri()) return "web preview";
  const { getVersion } = await import("@tauri-apps/api/app");
  return `v${await getVersion()}`;
}
