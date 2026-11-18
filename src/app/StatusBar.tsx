import { useEffect, useState } from "react";
import { appVersionLabel } from "../lib/platform";
import { GearIcon } from "./GearIcon";

interface StatusBarProps {
  /** The active tool's status text. Empty shows "Ready". */
  text: string;
  onOpenSettings(): void;
}

export function StatusBar({ text, onOpenSettings }: StatusBarProps) {
  const [version, setVersion] = useState("");

  useEffect(() => {
    void appVersionLabel().then(setVersion);
  }, []);

  return (
    <footer className="statusbar">
      <button
        type="button"
        className="statusbar__gear"
        aria-label="Settings"
        title="Settings"
        onClick={onOpenSettings}
      >
        <GearIcon size={18} />
      </button>
      <span className="statusbar__dot" aria-hidden="true" />
      <span className="statusbar__text">{text === "" ? "Ready" : text}</span>
      <span className="statusbar__version">Nerd's Workbench {version}</span>
    </footer>
  );
}
