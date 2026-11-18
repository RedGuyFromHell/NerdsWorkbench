import { useSyncExternalStore } from "react";
import type { DiscDocument } from "./engine/document";

/** Re-renders the calling panel whenever the document changes. The panel then reads the document directly. */
export function useDocumentVersion(discDocument: DiscDocument): number {
  return useSyncExternalStore(discDocument.subscribe, discDocument.getVersion);
}
