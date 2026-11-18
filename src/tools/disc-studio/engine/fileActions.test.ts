// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscContent } from "./history";

const files = vi.hoisted(() => ({
  pickSaveFile: vi.fn<() => Promise<string | null>>(),
  writeFileBytes: vi.fn<() => Promise<void>>(),
}));
vi.mock("../../../lib/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/files")>()),
  ...files,
}));

import { DEFAULT_SETTINGS } from "./project";
import type { DiscDocument } from "./document";
import { saveProjectToDisk } from "./fileActions";

const committed: DiscContent = {
  settings: { ...DEFAULT_SETTINGS },
  layers: [],
  images: new Map(),
  mask: null,
  nextId: 1,
  selectedId: null,
};

// Only what saveProjectToDisk touches; the real document needs a canvas.
function fakeDocument() {
  const markSaved = vi.fn();
  const doc = {
    settings: { ...DEFAULT_SETTINGS },
    committed,
    markSaved,
    toProject: () => ({ settings: { ...DEFAULT_SETTINGS }, mask: null, images: {}, layers: [] }),
  };
  return { doc: doc as unknown as DiscDocument, markSaved };
}

const fakeUi = () => ({ status: vi.fn(), error: vi.fn() });

describe("saveProjectToDisk", () => {
  beforeEach(() => {
    files.pickSaveFile.mockReset();
    files.writeFileBytes.mockReset();
  });

  it("is true and marks the content saved once the file is written", async () => {
    files.pickSaveFile.mockResolvedValue("disc.nerd");
    files.writeFileBytes.mockResolvedValue();
    const { doc, markSaved } = fakeDocument();
    const ui = fakeUi();
    expect(await saveProjectToDisk(doc, ui)).toBe(true);
    expect(markSaved).toHaveBeenCalledWith(committed);
    expect(ui.status).toHaveBeenCalledWith("Saved disc.nerd.");
  });

  it("is false and leaves the work unsaved when the Save dialog is cancelled", async () => {
    files.pickSaveFile.mockResolvedValue(null);
    const { doc, markSaved } = fakeDocument();
    const ui = fakeUi();
    expect(await saveProjectToDisk(doc, ui)).toBe(false);
    expect(files.writeFileBytes).not.toHaveBeenCalled();
    expect(markSaved).not.toHaveBeenCalled();
    expect(ui.error).not.toHaveBeenCalled();
  });

  it("is false, shows the error and leaves the work unsaved when the write fails", async () => {
    files.pickSaveFile.mockResolvedValue("disc.nerd");
    files.writeFileBytes.mockRejectedValue(new Error("Access is denied."));
    const { doc, markSaved } = fakeDocument();
    const ui = fakeUi();
    expect(await saveProjectToDisk(doc, ui)).toBe(false);
    expect(markSaved).not.toHaveBeenCalled();
    expect(ui.error).toHaveBeenCalledWith("Access is denied.");
  });
});
