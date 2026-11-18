// What a key press means in Disc Studio. A pure decision: pointer.ts attaches the listener and
// actions.ts does the work. Mirrors disc-studio.html (lines 579-594).
import type { Tool } from "./document";

export const NUDGE_MM = 0.1;
export const NUDGE_SHIFT_MM = 1;

// WHY: the HTML guards fields only; a dialog needs the same guard, or Delete on its button would delete a layer.
const TYPING_TARGETS = "input,textarea,select,dialog";

const TOOL_KEYS: Readonly<Record<string, Tool>> = { v: "move", e: "erase", r: "restore" };

export interface KeyInput {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export type KeyCommand =
  | { type: "tool"; tool: Tool }
  | { type: "undo" }
  | { type: "nudge"; dx: number; dy: number }
  | { type: "delete" }
  | { type: "duplicate" };

/** True when the key press came from a field or a dialog, where keys belong to the user's typing. */
export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(TYPING_TARGETS) !== null;
}

function nudgeCommand(key: string, step: number): KeyCommand | null {
  switch (key) {
    case "ArrowLeft":
      return { type: "nudge", dx: -step, dy: 0 };
    case "ArrowRight":
      return { type: "nudge", dx: step, dy: 0 };
    case "ArrowUp":
      return { type: "nudge", dx: 0, dy: -step };
    case "ArrowDown":
      return { type: "nudge", dx: 0, dy: step };
    default:
      return null;
  }
}

/** The command a key press asks for, or null when it is not ours. Layer commands need a selection. */
export function keyCommand(input: KeyInput, hasSelection: boolean): KeyCommand | null {
  const key = input.key.toLowerCase();
  const control = input.ctrlKey || input.metaKey;
  const plain = !control && !input.altKey;
  const tool = TOOL_KEYS[key];
  if (plain && tool) return { type: "tool", tool };
  if (control && key === "z") return { type: "undo" };
  if (!hasSelection) return null;
  const nudge = nudgeCommand(input.key, input.shiftKey ? NUDGE_SHIFT_MM : NUDGE_MM);
  if (nudge) return nudge;
  if (input.key === "Delete" || input.key === "Backspace") return { type: "delete" };
  if (control && key === "d") return { type: "duplicate" };
  return null;
}
