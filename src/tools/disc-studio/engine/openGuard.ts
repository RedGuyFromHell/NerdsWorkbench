// What Open project does with unsaved work: ask first, then open, or stop. Pure: the dialog and the
// file reading live in useOpenGuard. The answers match the shell's exit prompt (Save, Don't save, Cancel).

/** What the user answered in the unsaved-work dialog. */
export type OpenChoice = "save" | "skip" | "cancel";

export type OpenStep = "open" | "ask" | "stop";

/** The first step: ask when the open design has changes no file holds, else open at once. */
export function stepBeforeOpening(dirty: boolean): OpenStep {
  return dirty ? "ask" : "open";
}

/** The step after the user answered. `saved` is the result of the save, when the choice was Save. A save that did not write stops the open. */
export function stepAfterChoice(choice: OpenChoice, saved: boolean): OpenStep {
  if (choice === "skip") return "open";
  return choice === "save" && saved ? "open" : "stop";
}
