// Reading and writing files the user picked, through the two Rust commands in src-tauri/src/files.rs
// (raw bytes both ways) and the native dialogs. In a plain browser (the Vite URL) there is no disk
// access: every call throws one clear error, so the screen can still be built and looked at.
import { isTauri } from "./platform";

export interface FileFilter {
  name: string;
  extensions: string[]; // without the dot
}

interface PickOptions {
  title: string;
  filters: FileFilter[];
}

const PATH_HEADER = "x-file-path";
const FALLBACK_FILE_NAME = "disc-design";
const DESKTOP_ONLY = "Files can only be opened and saved in the desktop app.";

const MIME_TYPES: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
};

// #region Paths
/** The path as the `x-file-path` header carries it: HTTP headers are ASCII, a path can hold ș, ț and spaces. */
export function encodePathHeader(path: string): string {
  return encodeURIComponent(path);
}

export function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** A name Windows accepts for a file: its forbidden characters become "-", edge dots and spaces go. */
export function safeFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, "-")
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .trim();
  return cleaned || FALLBACK_FILE_NAME;
}

/** The image type a file name says, or "" for any other file. */
export function mimeTypeOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : (MIME_TYPES[name.slice(dot + 1).toLowerCase()] ?? "");
}
// #endregion

// #region Disk
function requireDesktop(): void {
  if (!isTauri()) throw new Error(DESKTOP_ONLY);
}

/** The whole file as bytes. */
export async function readFileBytes(path: string): Promise<Uint8Array> {
  requireDesktop();
  const { invoke } = await import("@tauri-apps/api/core");
  return new Uint8Array(await invoke<ArrayBuffer>("read_file_bytes", { path }));
}

/** Writes the bytes to the path, replacing what is there. The bytes go as the raw request body. */
export async function writeFileBytes(path: string, bytes: Uint8Array): Promise<void> {
  requireDesktop();
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("write_file_bytes", bytes, { headers: { [PATH_HEADER]: encodePathHeader(path) } });
}
// #endregion

// #region Dialogs
/** The paths the user picked, or an empty list when the dialog was cancelled. */
export async function pickOpenFiles(options: PickOptions): Promise<string[]> {
  requireDesktop();
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({ ...options, multiple: true, directory: false });
  return picked ?? [];
}

/** The path the user picked, or null when the dialog was cancelled. */
export async function pickOpenFile(options: PickOptions): Promise<string | null> {
  requireDesktop();
  const { open } = await import("@tauri-apps/plugin-dialog");
  return open({ ...options, multiple: false, directory: false });
}

/** The path the user chose to save to (the dialog asks before replacing a file), or null when cancelled. */
export async function pickSaveFile(
  options: PickOptions & { defaultName: string },
): Promise<string | null> {
  requireDesktop();
  const { save } = await import("@tauri-apps/plugin-dialog");
  const { defaultName, ...rest } = options;
  return save({ ...rest, defaultPath: defaultName });
}
// #endregion
