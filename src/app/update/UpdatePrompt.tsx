import { useState } from "react";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { ProgressBar } from "../../ui/ProgressBar";
import { NO_PROGRESS, progressFraction } from "./progress";
import type { DownloadProgress } from "./progress";
import { installUpdate, relaunchApp } from "./updateCheck";
import type { AvailableUpdate } from "./updateCheck";

interface UpdatePromptProps {
  update: AvailableUpdate;
  onClose(): void;
  /** Runs the download only when the user allowed the restart (the shell asks about unsaved work). */
  beforeInstall(proceed: () => void): void;
}

type Phase = { kind: "asking" } | { kind: "installing" } | { kind: "failed"; message: string };

/** "A new version is out": Update now downloads, installs and restarts; Later just closes. */
export function UpdatePrompt({ update, onClose, beforeInstall }: UpdatePromptProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "asking" });
  const [progress, setProgress] = useState<DownloadProgress>(NO_PROGRESS);

  const install = () => {
    setPhase({ kind: "installing" });
    installUpdate(update, relaunchApp, setProgress).catch((error: unknown) => {
      setPhase({ kind: "failed", message: error instanceof Error ? error.message : String(error) });
    });
  };
  // WHY: the update restarts the app without a close request, so unsaved work is asked about first.
  const updateNow = () => beforeInstall(install);

  const installing = phase.kind === "installing";
  // WHY: closing mid-download would leave a half-installed update behind a window that vanished.
  const close = () => {
    if (!installing) onClose();
  };

  const actions =
    phase.kind === "asking" ? (
      <>
        <Button onClick={close}>Later</Button>
        <Button variant="primary" onClick={updateNow}>
          Update now
        </Button>
      </>
    ) : phase.kind === "failed" ? (
      <Button onClick={close}>Close</Button>
    ) : null;

  return (
    <Dialog title="Update available" colour="green" onClose={close} actions={actions}>
      <p>
        <strong>Version {update.version}</strong> of Nerd's Workbench is ready.
      </p>
      {update.notes ? <p className="update-notes">{update.notes}</p> : null}
      {installing ? (
        <ProgressBar value={progressFraction(progress)} label="Downloading the update" />
      ) : null}
      {phase.kind === "failed" ? (
        <p role="alert">The update failed: {phase.message}. You can try again from Settings.</p>
      ) : null}
    </Dialog>
  );
}
