import { useEffect, useState } from "react";
import { appVersionLabel } from "../lib/platform";

interface StatusBarProps {
  /** The active tool's status text. Empty shows "Ready". */
  text: string;
}

export function StatusBar({ text }: StatusBarProps) {
  const [version, setVersion] = useState("");

  useEffect(() => {
    void appVersionLabel().then(setVersion);
  }, []);

  return (
    <footer className="statusbar">
      <span className="statusbar__dot" aria-hidden="true" />
      <span className="statusbar__text">{text === "" ? "Ready" : text}</span>
      <span className="statusbar__version">Nerd's Workbench {version}</span>
    </footer>
  );
}
