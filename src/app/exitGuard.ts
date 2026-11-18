// Which tools the shell must ask about before the user leaves, and what each answer leads to.
// Pure: the dialog and the actual exit live in the hook.
import type { ToolId } from "../tools/types";
import type { Screen } from "./screenHistory";

/** Something that would drop the screen the user is on. */
export type Exit =
  /** Escape, Back, Forward or HOME: only the tool being left is at stake. */
  | { kind: "leave"; from: Screen; to: Screen }
  /** The window closes or the app restarts for an update: every tool is at stake. */
  | { kind: "close"; on: Screen };

/** What the user answered for one tool. */
export type ExitOutcome = "saved" | "skipped" | "cancelled" | "saveFailed";

export type ExitStep =
  /** Ask about `tool`; `pending` is the whole list still to ask, `tool` first. */
  | { kind: "ask"; tool: ToolId; pending: readonly ToolId[] }
  | { kind: "proceed" }
  | { kind: "abort" };

/** The tools to ask about, in order. `unsavedIds` are the tools that hold unsaved work. */
export function planExit(exit: Exit, unsavedIds: readonly ToolId[]): ToolId[] {
  if (exit.kind === "leave") {
    if (exit.from === "home" || exit.from === exit.to) return [];
    return unsavedIds.includes(exit.from) ? [exit.from] : [];
  }
  // The tool on screen goes first: the user sees what they are asked about.
  const onScreen = unsavedIds.filter((id) => id === exit.on);
  return [...onScreen, ...unsavedIds.filter((id) => id !== exit.on)];
}

/** The first step of a plan: ask about the first tool, or go ahead when the list is empty. */
export function askNext(pending: readonly ToolId[]): ExitStep {
  const [tool] = pending;
  return tool === undefined ? { kind: "proceed" } : { kind: "ask", tool, pending };
}

/** The step after the user answered for the first tool in `pending`. Cancel and a failed save stop the whole exit. */
export function nextExitStep(pending: readonly ToolId[], outcome: ExitOutcome): ExitStep {
  if (outcome === "cancelled" || outcome === "saveFailed") return { kind: "abort" };
  return askNext(pending.slice(1));
}
