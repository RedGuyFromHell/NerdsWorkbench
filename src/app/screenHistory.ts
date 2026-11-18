// The screens the user has visited, walked with Back and Forward like a browser. Pure.
import type { ToolId } from "../tools/types";

/** A screen is the home grid or one tool. */
export type Screen = "home" | ToolId;

export interface ScreenHistory {
  readonly entries: readonly Screen[];
  /** The entry on screen. */
  readonly index: number;
}

export const MAX_SCREEN_ENTRIES = 50;

export const startHistory: ScreenHistory = { entries: ["home"], index: 0 };

export function currentScreen(history: ScreenHistory): Screen {
  return history.entries[history.index] ?? "home";
}

/** Go to a screen: the forward entries are dropped. The screen already on view changes nothing. */
export function visit(history: ScreenHistory, screen: Screen): ScreenHistory {
  if (currentScreen(history) === screen) return history;
  const entries = [...history.entries.slice(0, history.index + 1), screen].slice(
    -MAX_SCREEN_ENTRIES,
  );
  return { entries, index: entries.length - 1 };
}

/** One entry back; the same object at the start. */
export function back(history: ScreenHistory): ScreenHistory {
  return history.index === 0 ? history : { ...history, index: history.index - 1 };
}

/** One entry forward; the same object at the end. */
export function forward(history: ScreenHistory): ScreenHistory {
  return history.index >= history.entries.length - 1
    ? history
    : { ...history, index: history.index + 1 };
}
