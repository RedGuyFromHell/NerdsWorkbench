// What a run's files are called: the images, in the format chosen from the template's own
// extension, and the file that lists the codes.
import { safeFileName } from "../../../lib/files";

export interface OutputFile {
  format: "JPG" | "PNG";
  mimeType: "image/jpeg" | "image/png";
  extension: ".jpg" | ".png";
  /** For `canvas.toBlob`; undefined for PNG, which is lossless. */
  quality: number | undefined;
}

const JPEG_QUALITY = 0.95;
const JPEG_EXTENSIONS = [".jpg", ".jpeg"];

const JPG_OUTPUT: OutputFile = {
  format: "JPG",
  mimeType: "image/jpeg",
  extension: ".jpg",
  quality: JPEG_QUALITY,
};
const PNG_OUTPUT: OutputFile = {
  format: "PNG",
  mimeType: "image/png",
  extension: ".png",
  quality: undefined,
};

/** A JPG or JPEG template gives JPG; every other template (PNG, WebP) gives PNG. */
export function getOutputFile(templatePath: string): OutputFile {
  return JPEG_EXTENSIONS.includes(getExtension(templatePath)) ? JPG_OUTPUT : PNG_OUTPUT;
}

export function getOutputFileName(code: string, output: OutputFile): string {
  return `${code}${output.extension}`;
}

/**
 * The codes file of one run: `codes-<prefix>-<yyyyMMdd-HHmmss>.csv`, the local time the run started.
 * WHY: the file is the only full record of a discount's codes, so a second run must never
 * replace the first run's file. The prefix loses its trailing dash, which the name adds itself.
 */
export function getCodesFileName(prefix: string, startedAt: Date): string {
  const twoDigits = (part: number) => String(part).padStart(2, "0");
  const day = [startedAt.getFullYear(), startedAt.getMonth() + 1, startedAt.getDate()];
  const time = [startedAt.getHours(), startedAt.getMinutes(), startedAt.getSeconds()];
  const stamp = `${day.map(twoDigits).join("")}-${time.map(twoDigits).join("")}`;
  return safeFileName(`codes-${prefix.replace(/-+$/, "")}-${stamp}.csv`);
}

// WHY: the same rule as Python's Path.suffix: the part of the last name from its final dot, and
// empty for ".jpg" (a hidden file) or "name." (a trailing dot).
function getExtension(path: string): string {
  const name = path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  return name.slice(dot).toLowerCase();
}
