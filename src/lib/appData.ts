// Small text files in the app data folder (settings, saved months), through the three Rust commands
// in src-tauri/src/app_data.rs. The page names a path relative to that folder, never an absolute
// one; Rust refuses anything else. In a plain browser (the Vite URL) there is no disk: every call
// throws one clear error, so a tool can fall back to a memory store.
import { isTauri } from "./platform";

const DESKTOP_ONLY = "App data can only be read and written in the desktop app.";

async function callCommand<T>(command: string, args: Record<string, string>): Promise<T> {
  if (!isTauri()) throw new Error(DESKTOP_ONLY);
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    return await invoke<T>(command, args);
  } catch (failure) {
    // WHY: a Rust command that fails rejects with its message as a plain string, not an Error.
    throw failure instanceof Error ? failure : new Error(String(failure));
  }
}

/** The text of the file, or null when there is no such file yet. */
export function readAppText(path: string): Promise<string | null> {
  return callCommand<string | null>("read_app_text", { path });
}

/** Writes the text whole, making the folders; a file marked `"status": "closed"` is refused. */
export async function writeAppText(path: string, text: string): Promise<void> {
  await callCommand<null>("write_app_text", { path, text });
}

/** The sorted file names in a folder; empty when the folder does not exist. */
export function listAppFiles(folder: string): Promise<string[]> {
  return callCommand<string[]>("list_app_files", { folder });
}
