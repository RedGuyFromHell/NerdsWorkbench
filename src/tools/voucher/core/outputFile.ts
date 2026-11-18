// What the generated images are saved as, chosen from the template's own extension.

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

// WHY: the same rule as Python's Path.suffix: the part of the last name from its final dot, and
// empty for ".jpg" (a hidden file) or "name." (a trailing dot).
function getExtension(path: string): string {
  const name = path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  return name.slice(dot).toLowerCase();
}
