import { useEffect, useRef } from "react";
import { onWindowCloseRequested, windowControls } from "../lib/platform";
import type { CloseRequest } from "../lib/platform";

const destroyWindow = () => void windowControls.destroy().catch(() => undefined);

/**
 * Asks before the window closes (the X button, Alt+F4 and the taskbar all raise the same request).
 * With nothing unsaved it does nothing and the window closes by itself. Otherwise it stops the close,
 * runs `askBeforeClosing`, and that calls `proceed` when the window may really go.
 */
export function useCloseGuard(
  hasUnsavedWork: () => boolean,
  askBeforeClosing: (proceed: () => void) => void,
): void {
  const latest = useRef({ hasUnsavedWork, askBeforeClosing });
  useEffect(() => {
    latest.current = { hasUnsavedWork, askBeforeClosing };
  });

  useEffect(() => {
    // WHY: listening is async. React runs this effect twice in dev, and a registration that
    // resolves after its cleanup must undo itself, or every close would ask twice.
    let cancelled = false;
    let unlisten: (() => void) | null = null;

    const onClose = (request: CloseRequest) => {
      try {
        if (!latest.current.hasUnsavedWork()) return;
        request.preventDefault();
        latest.current.askBeforeClosing(destroyWindow);
      } catch {
        // WHY: a bug here must never leave a window that cannot be closed.
        request.preventDefault();
        destroyWindow();
      }
    };

    onWindowCloseRequested(onClose).then(
      (stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      },
      // No hook: the window then closes without asking, as before this guard existed.
      () => undefined,
    );
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}
