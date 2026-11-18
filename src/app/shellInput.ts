// What the shell does with a mouse button or a key. Pure: the hook gathers the inputs.

export type Direction = "back" | "forward";

/** The mouse side buttons: 3 is Back and 4 is Forward (the `button` of a mouse event). */
export function sideButtonDirection(button: number): Direction | null {
  if (button === 3) return "back";
  if (button === 4) return "forward";
  return null;
}

export interface EscapeInput {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  repeat: boolean;
  isComposing: boolean;
  /** A tool that handled the key itself called preventDefault. */
  defaultPrevented: boolean;
  /** A tool is on screen, not the home grid. */
  onTool: boolean;
  /** A `dialog[open]` exists anywhere in the document. */
  dialogOpen: boolean;
  /** The key came from a field, a select or a dialog (`isTypingTarget`). */
  typing: boolean;
}

/** True when Escape should take the user from a tool to the home screen. */
export function leavesToolOnKey(input: EscapeInput): boolean {
  if (input.key !== "Escape") return false;
  if (input.ctrlKey || input.altKey || input.shiftKey || input.metaKey) return false;
  if (input.repeat || input.isComposing || input.defaultPrevented) return false;
  return input.onTool && !input.dialogOpen && !input.typing;
}
