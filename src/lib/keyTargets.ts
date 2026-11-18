// Where a key press came from. Shared by every tool and the shell: a shortcut must leave the key to
// the user's typing or to a dialog. Pure, DOM types only.

// WHY: the HTML guards fields only; a dialog needs the same guard, or Delete on its button would delete a layer.
const TYPING_TARGETS = "input,textarea,select,dialog";

// WHY: an input of another type (checkbox, colour, range) has no text for the browser to undo.
const TEXT_INPUT_TYPES: readonly string[] = [
  "text",
  "search",
  "url",
  "tel",
  "email",
  "password",
  "number",
];

/** True when the key press came from a field or a dialog, where keys belong to the user's typing. */
export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(TYPING_TARGETS) !== null;
}

export function isInsideDialog(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("dialog") !== null;
}

/** True for a place the browser keeps an undo history of its own: a textarea, a text-like input, editable content. */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("textarea") !== null) return true;
  if (target instanceof HTMLInputElement) return TEXT_INPUT_TYPES.includes(target.type);
  const editable = target.closest("[contenteditable]");
  return editable !== null && editable.getAttribute("contenteditable") !== "false";
}
