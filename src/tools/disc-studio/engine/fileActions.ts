// The buttons that go through the Windows file dialogs: add images, upload a mask, open and save
// a project, export the print or the preview. Each asks for the path first, then reads or writes
// it. A failure goes to ui.error (a dialog); a success goes to ui.status (the status bar).
import {
  fileNameOf,
  mimeTypeOf,
  PROJECT_EXTENSION,
  pickOpenFile,
  pickOpenFiles,
  pickSaveFile,
  readFileBytes,
  safeFileName,
  writeFileBytes,
  type FileFilter,
} from "../../../lib/files";
import { addImageFiles, setUploadedMask, type FileUi } from "./actions";
import type { DiscDocument } from "./document";
import { insertPhysChunk } from "./pngDpi";
import { parseProject, serializeProject } from "./project";

const IMAGE_FILTER: FileFilter = {
  name: "Images",
  extensions: ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "svg"],
};
// WHY: an old project saved by the HTML ends in .disc.json; the dialog filter sees only "json".
const OPEN_PROJECT_FILTER: FileFilter = {
  name: "Disc Studio project",
  extensions: ["nerd", "json"],
};
const SAVE_PROJECT_FILTER: FileFilter = { name: "Disc Studio project", extensions: ["nerd"] };
const PNG_FILTER: FileFilter = { name: "PNG image", extensions: ["png"] };

/** Runs the action; any error it throws is shown through ui.error. */
async function guarded(ui: FileUi, action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    ui.error(error instanceof Error ? error.message : String(error));
  }
}

async function fileAt(path: string): Promise<File> {
  const bytes = await readFileBytes(path);
  const name = fileNameOf(path);
  return new File([new Uint8Array(bytes)], name, { type: mimeTypeOf(name) });
}

// #region Images and mask
export function addImagesFromDisk(discDocument: DiscDocument, ui: FileUi): Promise<void> {
  return guarded(ui, async () => {
    const paths = await pickOpenFiles({ title: "Add images", filters: [IMAGE_FILTER] });
    const files = await Promise.all(paths.map(fileAt));
    await addImageFiles(discDocument, files, ui);
  });
}

export function uploadMaskFromDisk(discDocument: DiscDocument, ui: FileUi): Promise<void> {
  return guarded(ui, async () => {
    const path = await pickOpenFile({ title: "Upload a mask", filters: [IMAGE_FILTER] });
    if (!path) return;
    await setUploadedMask(discDocument, await fileAt(path));
    ui.status(`Mask ${fileNameOf(path)} is in use.`);
  });
}
// #endregion

// #region Project
/** Reads a .nerd or .disc.json file and replaces the open design with it. */
export async function openProjectAt(discDocument: DiscDocument, path: string): Promise<void> {
  const text = new TextDecoder().decode(await readFileBytes(path));
  await discDocument.open(parseProject(text));
}

/** Opens a project from a path that is already known (a file Explorer handed over). */
export function openProjectFromPath(
  discDocument: DiscDocument,
  path: string,
  ui: FileUi,
): Promise<void> {
  return guarded(ui, async () => {
    await openProjectAt(discDocument, path);
    ui.status(`Opened ${fileNameOf(path)}.`);
  });
}

export function openProjectFromDisk(discDocument: DiscDocument, ui: FileUi): Promise<void> {
  return guarded(ui, async () => {
    const path = await pickOpenFile({ title: "Open a project", filters: [OPEN_PROJECT_FILTER] });
    if (!path) return;
    await openProjectAt(discDocument, path);
    ui.status(`Opened ${fileNameOf(path)}.`);
  });
}

/** Writes the design as a .nerd file: JSON with the "tool" and "version" fields. */
export function saveProjectAt(discDocument: DiscDocument, path: string): Promise<void> {
  return writeFileBytes(path, new TextEncoder().encode(serializeProject(discDocument.toProject())));
}

/** True once the file is written. False when the Save dialog was cancelled or the write failed (the error is already in ui.error). */
export async function saveProjectToDisk(discDocument: DiscDocument, ui: FileUi): Promise<boolean> {
  let written = false;
  await guarded(ui, async () => {
    const path = await pickSaveFile({
      title: "Save the project",
      defaultName: safeFileName(discDocument.settings.name) + PROJECT_EXTENSION,
      filters: [SAVE_PROJECT_FILTER],
    });
    if (!path) return;
    // WHY: what the file holds is what the document was when the write started, not when it ended.
    const saved = discDocument.committed;
    await saveProjectAt(discDocument, path);
    discDocument.markSaved(saved);
    ui.status(`Saved ${fileNameOf(path)}.`);
    written = true;
  });
  return written;
}
// #endregion

// #region Export
// WHY: toBlob copies the canvas when it is called, so nothing may redraw it between the draw and this call.
function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("The image could not be made."));
      else void blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject);
    }, "image/png");
  });
}

/** Writes the PNG with the DPI in its pHYs chunk. `print`: transparent where there is no ink, no guides. `preview`: what the canvas shows, without the selection. */
export async function exportPngAt(
  discDocument: DiscDocument,
  path: string,
  kind: "print" | "preview",
): Promise<void> {
  let png: Promise<Uint8Array>;
  if (kind === "print") {
    png = canvasToPng(discDocument.renderer.compose());
  } else {
    discDocument.renderer.draw({ withSelection: false });
    png = canvasToPng(discDocument.view);
    discDocument.requestDraw(); // puts the selection box and brush outline back
  }
  await writeFileBytes(path, insertPhysChunk(await png, discDocument.settings.dpi));
}

export function exportPng(
  discDocument: DiscDocument,
  ui: FileUi,
  kind: "print" | "preview",
): Promise<void> {
  return guarded(ui, async () => {
    const suffix = kind === "preview" ? "-preview" : "";
    const path = await pickSaveFile({
      title: kind === "preview" ? "Export the preview" : "Export the print PNG",
      defaultName: `${safeFileName(discDocument.settings.name)}${suffix}.png`,
      filters: [PNG_FILTER],
    });
    if (!path) return;
    await exportPngAt(discDocument, path, kind);
    ui.status(`Exported ${fileNameOf(path)} at ${discDocument.settings.dpi} dpi.`);
  });
}
// #endregion
