// The update check, kept apart from the Tauri plugin so it can be tested with a fake checker.
// The plugin calls live in realUpdateChecker and relaunchApp; everything else is plain logic.
import { isTauri } from "../../lib/platform";
import { applyDownloadEvent, NO_PROGRESS } from "./progress";
import type { DownloadEvent, DownloadProgress } from "./progress";

/** An update the server offers: what the prompt shows, and the call that installs it. */
export interface AvailableUpdate {
  version: string;
  notes: string | null;
  downloadAndInstall(onEvent: (event: DownloadEvent) => void): Promise<void>;
}

/** Asks the server for a newer version. Resolves null when this one is the latest. */
export type UpdateChecker = () => Promise<AvailableUpdate | null>;

export type UpdateCheckResult =
  | { kind: "up-to-date" }
  | { kind: "available"; update: AvailableUpdate }
  | { kind: "failed"; message: string };

/** Never throws: offline, a missing latest.json or a bad reply all come back as "failed". */
export async function runUpdateCheck(check: UpdateChecker): Promise<UpdateCheckResult> {
  try {
    const update = await check();
    return update === null ? { kind: "up-to-date" } : { kind: "available", update };
  } catch (error) {
    // WHY: the Tauri plugin rejects with plain strings, not Error objects.
    return { kind: "failed", message: error instanceof Error ? error.message : String(error) };
  }
}

/** The line shown after a check the user asked for (Settings). */
export function checkResultMessage(result: UpdateCheckResult): string {
  switch (result.kind) {
    case "up-to-date":
      return "Nerd's Workbench is up to date.";
    case "available":
      return `Version ${result.update.version} is available.`;
    case "failed":
      return `Could not check for updates: ${result.message}`;
  }
}

/** The status bar text after the automatic check on start: quiet unless it failed. */
export function startupNotice(result: UpdateCheckResult): string {
  return result.kind === "failed" ? "Update check failed (offline?)" : "";
}

/** The automatic check runs only in the installed app: a dev build has no signed updates. */
export function shouldCheckOnStart(env: { inTauri: boolean; dev: boolean }): boolean {
  return env.inTauri && !env.dev;
}

export function checkOnStartHere(): boolean {
  return shouldCheckOnStart({ inTauri: isTauri(), dev: import.meta.env.DEV });
}

/** Downloads and installs, reporting progress, then restarts the app. A failure never restarts. */
export async function installUpdate(
  update: AvailableUpdate,
  relaunch: () => Promise<void>,
  onProgress: (state: DownloadProgress) => void,
): Promise<void> {
  let state = NO_PROGRESS;
  await update.downloadAndInstall((event) => {
    state = applyDownloadEvent(state, event);
    onProgress(state);
  });
  await relaunch();
}

// WHY: the plugin modules are imported on demand, so a plain browser never loads them.
export const realUpdateChecker: UpdateChecker = async () => {
  if (!isTauri()) throw new Error("updates only work in the installed app");
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (update === null) return null;
  return {
    version: update.version,
    notes: update.body ?? null,
    downloadAndInstall: (onEvent) => update.downloadAndInstall(onEvent),
  };
};

export async function relaunchApp(): Promise<void> {
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}
