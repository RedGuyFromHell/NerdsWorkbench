import { useCallback, useState } from "react";
import type { FileUi } from "./engine/actions";
import type { DiscDocument } from "./engine/document";
import { saveProjectToDisk } from "./engine/fileActions";
import { stepAfterChoice, stepBeforeOpening, type OpenChoice } from "./engine/openGuard";

/** An open waiting for the user's answer about the unsaved changes. */
interface PendingOpen {
  open(): Promise<void>;
  saving: boolean;
}

/**
 * Asks before an open replaces unsaved work (the Open project button, a file Explorer handed over).
 * `guardedOpen` runs the open at once when nothing is unsaved, else it raises `pending` for the
 * dialog; `answer` then opens, or stops, as the user chose. A newer request replaces an older one.
 */
export function useOpenGuard(doc: DiscDocument | null, ui: FileUi) {
  const [pending, setPending] = useState<PendingOpen | null>(null);

  const guardedOpen = useCallback(
    (open: () => Promise<void>) => {
      if (!doc) return;
      if (stepBeforeOpening(doc.isDirty()) === "open") {
        void open();
        return;
      }
      setPending({ open, saving: false });
    },
    [doc],
  );

  const answer = useCallback(
    async (choice: OpenChoice) => {
      if (!doc || !pending || pending.saving) return;
      let saved = false;
      if (choice === "save") {
        setPending({ ...pending, saving: true });
        saved = await saveProjectToDisk(doc, ui);
      }
      setPending(null);
      if (stepAfterChoice(choice, saved) === "open") await pending.open();
    },
    [doc, pending, ui],
  );

  return { pending, guardedOpen, answer };
}
