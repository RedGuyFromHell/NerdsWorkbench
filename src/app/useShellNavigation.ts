import { useEffect, useRef } from "react";
import { isTypingTarget } from "../lib/keyTargets";
import { leavesToolOnKey, sideButtonDirection } from "./shellInput";
import type { Direction } from "./shellInput";

interface ShellNavigation {
  /** A tool is on screen, not the home grid. */
  onTool: boolean;
  goHome(): void;
  move(direction: Direction): void;
}

const dialogIsOpen = () => document.querySelector("dialog[open]") !== null;

// WHY: the Disc Studio canvas starts a drag on any pointerdown, whatever the button, so a side button
// over it would grab a layer. preventDefault on a pointer event would silence the mouse events that
// follow, and mouseup is where we act, so these two only stop propagation.
const SIDE_BUTTON_EVENTS = [
  "pointerdown",
  "pointerup",
  "mousedown",
  "mouseup",
  "auxclick",
] as const satisfies readonly (keyof WindowEventMap)[];

/**
 * The mouse side buttons walk the visited screens and Escape on a tool goes home. Listeners sit on
 * `window` and stay for the life of the app; the latest actions are read through a ref. The actions
 * are the only way this hook changes the screen.
 */
export function useShellNavigation({ onTool, goHome, move }: ShellNavigation): void {
  const latest = useRef({ onTool, goHome, move });
  useEffect(() => {
    latest.current = { onTool, goHome, move };
  });

  useEffect(() => {
    // Capture phase, so no tool sees the side buttons. preventDefault also means WebView2 never
    // navigates the page by itself, even if a link or a route is added one day.
    const onSideButton = (event: MouseEvent | PointerEvent) => {
      const direction = sideButtonDirection(event.button);
      if (direction === null) return;
      event.stopPropagation();
      if (!event.type.startsWith("pointer")) event.preventDefault();
      // The move happens once, on mouseup, and never under a modal dialog.
      if (event.type === "mouseup" && !dialogIsOpen()) latest.current.move(direction);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const goesHome = leavesToolOnKey({
        key: event.key,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        metaKey: event.metaKey,
        repeat: event.repeat,
        isComposing: event.isComposing,
        defaultPrevented: event.defaultPrevented,
        onTool: latest.current.onTool,
        dialogOpen: dialogIsOpen(),
        typing: isTypingTarget(event.target),
      });
      if (goesHome) latest.current.goHome();
    };

    for (const type of SIDE_BUTTON_EVENTS) window.addEventListener(type, onSideButton, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      for (const type of SIDE_BUTTON_EVENTS) window.removeEventListener(type, onSideButton, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
