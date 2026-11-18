import { windowControls } from "../lib/platform";
import { Button } from "../ui/Button";
import { RetroTitleBar } from "../ui/RetroWindow";

interface TitleBarProps {
  /** Set while a tool is open: shows a Home button. */
  onHome: (() => void) | null;
}

/** The app's own title bar. The OS frame is switched off (decorations: false), so this drags,
 * minimises, maximises and closes the window itself. */
export function TitleBar({ onHome }: TitleBarProps) {
  const controls = (
    <>
      <button
        type="button"
        className="window-button"
        aria-label="Minimise"
        title="Minimise"
        onClick={() => void windowControls.minimize()}
      >
        <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor">
          <path d="M2 9h8" strokeWidth="2.4" />
        </svg>
      </button>
      <button
        type="button"
        className="window-button"
        aria-label="Maximise"
        title="Maximise"
        onClick={() => void windowControls.toggleMaximize()}
      >
        <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor">
          <rect x="2" y="2" width="8" height="8" strokeWidth="2.2" />
        </svg>
      </button>
      <button
        type="button"
        className="window-button window-button--close"
        aria-label="Close"
        title="Close"
        onClick={() => void windowControls.close()}
      >
        <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor">
          <path d="M2 2l8 8M10 2l-8 8" strokeWidth="2.4" />
        </svg>
      </button>
    </>
  );

  const homeButton = onHome ? (
    <Button onClick={onHome} aria-label="Back to the home screen">
      &lt; HOME
    </Button>
  ) : null;

  return (
    <RetroTitleBar
      title="Nerd's Workbench"
      colour="brand"
      leading={homeButton}
      controls={controls}
      dragRegion
    />
  );
}
