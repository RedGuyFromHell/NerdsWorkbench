// What a key press means in Disc Studio. A pure decision: pointer.ts attaches the listener and
// actions.ts does the work. Mirrors disc-studio.html (lines 579-594).
import { isInsideDialog, isTextEntryTarget, isTypingTarget } from "../../../lib/keyTargets";
import type { Tool } from "./document";

export const NUDGE_MM = 0.1;
export const NUDGE_SHIFT_MM = 1;

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
  | { type: "redo" }
  | { type: "nudge"; dx: number; dy: number }
  | { type: "delete" }
  | { type: "duplicate" };

/**
 * True when the key press belongs to where it came from. Undo and redo stay ours on a select, a
 * checkbox or the colour input, where the browser has no undo of its own; every other key stays
 * out of any field.
 */
export function ignoresKey(command: KeyCommand, target: EventTarget | null): boolean {
  if (command.type === "undo" || command.type === "redo") {
    return isInsideDialog(target) || isTextEntryTarget(target);
  }
  return isTypingTarget(target);
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
  if (control && key === "z") return { type: input.shiftKey ? "redo" : "undo" };
  if (control && key === "y") return { type: "redo" };
  if (!hasSelection) return null;
  const nudge = nudgeCommand(input.key, input.shiftKey ? NUDGE_SHIFT_MM : NUDGE_MM);
  if (nudge) return nudge;
  if (input.key === "Delete" || input.key === "Backspace") return { type: "delete" };
  if (control && key === "d") return { type: "duplicate" };
  return null;
}
