// Tells the UI whether it runs inside the Tauri window or in a plain browser (the Vite URL).
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
