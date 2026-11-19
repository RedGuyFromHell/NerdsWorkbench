// The installed font families, for a font picker. The page cannot list system fonts, so Rust reads
// them (src-tauri/src/fonts.rs). In a plain browser (the Vite URL) a short fixed list stands in, so
// the screen can still be looked at.
import { z } from "zod";
import { isTauri } from "./platform";

const WEB_PREVIEW_FAMILIES = ["Arial", "Courier New", "Georgia", "Impact", "Times New Roman"];

const familiesSchema = z.array(z.string());

export async function listFontFamilies(): Promise<string[]> {
  if (!isTauri()) return WEB_PREVIEW_FAMILIES;
  const { invoke } = await import("@tauri-apps/api/core");
  return familiesSchema.parse(await invoke("list_font_families"));
}
