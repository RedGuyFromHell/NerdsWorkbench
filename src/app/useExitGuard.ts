import { useCallback, useRef, useState } from "react";
import type { ToolId, UnsavedWork } from "../tools/types";
import { askNext, nextExitStep, planExit } from "./exitGuard";
import type { Exit, ExitOutcome, ExitStep } from "./exitGuard";

/** What the user can do in the unsaved-work dialog. */
export type ExitChoice = "save" | "skip" | "cancel";

interface Prompt {
  /** The tool the dialog is about. */
  tool: ToolId;
  /** Every tool still to ask about, `tool` first. */
  pending: readonly ToolId[];
  /** What the exit does once nothing is left to ask. */
  proceed(): void;
  saving: boolean;
}

// The contract says save() never throws; a tool that breaks it must not leave the exit hanging.
async function runSave(work: UnsavedWork | undefined): Promise<boolean> {
  if (!work) return true;
  try {
    return await work.save();
  } catch (error) {
    console.warn("A tool's save threw; treated as a failed save.", error);
    return false;
  }
}

/**
 * The unsaved-work guard of the shell. Tools report their work through `setUnsavedWork`; every way
 * out (HOME, Escape, the mouse buttons, the window close, an update restart) goes through
 * `requestExit`, which asks first and runs `proceed` only when the user allowed it.
 * `showTool` brings a tool on screen, so the dialog and a failed save's error are visible.
 */
export function useExitGuard(showTool: (id: ToolId) => void) {
  const works = useRef(new Map<ToolId, UnsavedWork>());
  // WHY: set at once, so a second exit request in the same moment (a click, then Alt+F4) is ignored.
  const asking = useRef(false);
  const [prompt, setPrompt] = useState<Prompt | null>(null);

  const setUnsavedWork = useCallback((id: ToolId, work: UnsavedWork | null) => {
    if (work) works.current.set(id, work);
    else works.current.delete(id);
  }, []);

  const hasUnsavedWork = useCallback(() => works.current.size > 0, []);

  const continueWith = useCallback(
    (step: ExitStep, proceed: () => void) => {
      let stillAsking = false;
      try {
        if (step.kind === "ask") {
          showTool(step.tool);
          setPrompt({ tool: step.tool, pending: step.pending, proceed, saving: false });
          stillAsking = true;
          return;
        }
        if (step.kind === "proceed") proceed();
      } finally {
        // WHY: a throw from showTool or proceed must not leave `asking` set, or every later exit is ignored.
        if (!stillAsking) {
          asking.current = false;
          setPrompt(null);
        }
      }
    },
    [showTool],
  );

  const requestExit = useCallback(
    (exit: Exit, proceed: () => void) => {
      if (asking.current) {
        console.warn(
          "An exit request came while the unsaved-work prompt was open; it was ignored.",
        );
        return;
      }
      const step = askNext(planExit(exit, [...works.current.keys()]));
      if (step.kind === "proceed") {
        proceed();
        return;
      }
      asking.current = true;
      continueWith(step, proceed);
    },
    [continueWith],
  );

  const answer = useCallback(
    async (choice: ExitChoice) => {
      if (!prompt || prompt.saving) return;
      let outcome: ExitOutcome = choice === "skip" ? "skipped" : "cancelled";
      if (choice === "save") {
        setPrompt({ ...prompt, saving: true });
        outcome = (await runSave(works.current.get(prompt.tool))) ? "saved" : "saveFailed";
      }
      continueWith(nextExitStep(prompt.pending, outcome), prompt.proceed);
    },
    [prompt, continueWith],
  );

  return { prompt, setUnsavedWork, hasUnsavedWork, requestExit, answer };
}
