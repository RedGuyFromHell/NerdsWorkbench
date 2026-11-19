// Loading the voucher template: from a path the native dialog gave, or from a file dropped on the
// screen. Both end as a decoded bitmap the preview and, later, the export draw from.
import { fileNameOf, mimeTypeOf, readFileBytes } from "../../lib/files";

export interface VoucherTemplate {
  /** The path the user picked, or the file name of a dropped file. The save format follows its extension. */
  path: string;
  name: string;
  image: ImageBitmap;
  width: number;
  height: number;
}

const TEMPLATE_OPEN_ERROR = "This image cannot be opened.";

async function decodeTemplate(path: string, blob: Blob): Promise<VoucherTemplate> {
  const image = await createImageBitmap(blob).catch(() => {
    throw new Error(TEMPLATE_OPEN_ERROR);
  });
  return { path, name: fileNameOf(path), image, width: image.width, height: image.height };
}

export async function loadTemplateFromPath(path: string): Promise<VoucherTemplate> {
  const bytes = await readFileBytes(path);
  return decodeTemplate(path, new Blob([new Uint8Array(bytes)], { type: mimeTypeOf(path) }));
}

export function loadTemplateFromFile(file: File): Promise<VoucherTemplate> {
  return decodeTemplate(file.name, file);
}
