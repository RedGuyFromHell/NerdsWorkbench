// Dropping a file on the Voucher screen: tracks whether a file is being dragged over it, and hands
// the first dropped file on. Drags that carry no file (text, a link) are left to the browser.
import { useState, type DragEvent } from "react";

function carriesFiles(event: DragEvent): boolean {
  return event.dataTransfer.types.includes("Files");
}

export function useTemplateDrop(onFile: (file: File) => void) {
  const [dropping, setDropping] = useState(false);

  function onDragOver(event: DragEvent) {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    setDropping(true);
  }

  function onDragLeave(event: DragEvent) {
    const into = event.relatedTarget;
    if (into instanceof Node && event.currentTarget.contains(into)) return;
    setDropping(false);
  }

  function onDrop(event: DragEvent) {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    setDropping(false);
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  }

  return { dropping, dropProps: { onDragOver, onDragLeave, onDrop } };
}
