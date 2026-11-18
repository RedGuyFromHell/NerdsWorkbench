import { useEffect, useRef } from "react";
import type { ReactNode, SyntheticEvent } from "react";
import { RetroTitleBar, RetroWindow } from "./RetroWindow";
import type { BarColour } from "./RetroWindow";

interface DialogProps {
  title: string;
  colour?: BarColour;
  /** Called for the close box and for the Escape key. */
  onClose(): void;
  /** Buttons for the bottom row, usually Buttons. */
  actions?: ReactNode;
  children: ReactNode;
}

/** A modal retro window. Render it only while it is open. Focus trap and Escape come from <dialog>. */
export function Dialog({ title, colour = "yellow", onClose, actions, children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    // WHY: the guard keeps React's double effect run in dev from opening it twice (that throws).
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // WHY: without preventDefault the browser closes the <dialog> itself on Escape, while the parent
  // still renders it. The parent decides (it may refuse, mid-download) and unmounts it.
  const cancel = (event: SyntheticEvent) => {
    event.preventDefault();
    onClose();
  };

  const closeBox = (
    <button
      type="button"
      className="window-button window-button--close"
      aria-label="Close"
      onClick={onClose}
    >
      <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor">
        <path d="M2 2l8 8M10 2l-8 8" strokeWidth="2.4" />
      </svg>
    </button>
  );

  return (
    <dialog ref={dialogRef} className="dialog" onCancel={cancel} aria-label={title}>
      <RetroWindow
        floating
        titleBar={<RetroTitleBar title={title} colour={colour} controls={closeBox} />}
      >
        <div className="dialog__content">{children}</div>
        {actions ? <div className="dialog__actions">{actions}</div> : null}
      </RetroWindow>
    </dialog>
  );
}
