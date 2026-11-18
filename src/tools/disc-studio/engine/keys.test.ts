// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { isTypingTarget, keyCommand, type KeyInput } from "./keys";

const press = (key: string, modifiers: Partial<KeyInput> = {}): KeyInput => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...modifiers,
});

describe("tool keys", () => {
  it("V, E and R pick the move, erase and restore tools, in either case", () => {
    expect(keyCommand(press("v"), false)).toEqual({ type: "tool", tool: "move" });
    expect(keyCommand(press("E"), false)).toEqual({ type: "tool", tool: "erase" });
    expect(keyCommand(press("r"), true)).toEqual({ type: "tool", tool: "restore" });
  });

  it("do nothing with Ctrl, Meta or Alt held", () => {
    expect(keyCommand(press("e", { ctrlKey: true }), true)).toBeNull();
    expect(keyCommand(press("r", { metaKey: true }), true)).toBeNull();
    expect(keyCommand(press("v", { altKey: true }), true)).toBeNull();
  });
});

describe("undo", () => {
  it("is Ctrl+Z or Meta+Z, with or without a selection", () => {
    expect(keyCommand(press("z", { ctrlKey: true }), false)).toEqual({ type: "undo" });
    expect(keyCommand(press("Z", { metaKey: true }), true)).toEqual({ type: "undo" });
  });

  it("is not a plain Z", () => {
    expect(keyCommand(press("z"), true)).toBeNull();
  });
});

describe("nudge", () => {
  it("moves 0.1 mm an arrow, in screen directions", () => {
    expect(keyCommand(press("ArrowLeft"), true)).toEqual({ type: "nudge", dx: -0.1, dy: 0 });
    expect(keyCommand(press("ArrowRight"), true)).toEqual({ type: "nudge", dx: 0.1, dy: 0 });
    expect(keyCommand(press("ArrowUp"), true)).toEqual({ type: "nudge", dx: 0, dy: -0.1 });
    expect(keyCommand(press("ArrowDown"), true)).toEqual({ type: "nudge", dx: 0, dy: 0.1 });
  });

  it("moves 1 mm with Shift", () => {
    expect(keyCommand(press("ArrowRight", { shiftKey: true }), true)).toEqual({
      type: "nudge",
      dx: 1,
      dy: 0,
    });
  });

  it("needs a selected layer", () => {
    expect(keyCommand(press("ArrowLeft"), false)).toBeNull();
  });
});

describe("delete and copy", () => {
  it("Delete and Backspace delete the selected layer", () => {
    expect(keyCommand(press("Delete"), true)).toEqual({ type: "delete" });
    expect(keyCommand(press("Backspace"), true)).toEqual({ type: "delete" });
  });

  it("Ctrl+D copies it", () => {
    expect(keyCommand(press("d", { ctrlKey: true }), true)).toEqual({ type: "duplicate" });
    expect(keyCommand(press("D", { metaKey: true }), true)).toEqual({ type: "duplicate" });
  });

  it("need a selected layer", () => {
    expect(keyCommand(press("Delete"), false)).toBeNull();
    expect(keyCommand(press("d", { ctrlKey: true }), false)).toBeNull();
  });

  it("a plain D does nothing", () => {
    expect(keyCommand(press("d"), true)).toBeNull();
  });
});

describe("isTypingTarget", () => {
  it("is true for a field, and for anything inside a dialog", () => {
    document.body.innerHTML = `<input id="a"><textarea id="b"></textarea><select id="c"></select>
      <dialog open><button id="d"></button></dialog><button id="e"></button>`;
    for (const id of ["a", "b", "c", "d"]) {
      expect(isTypingTarget(document.getElementById(id))).toBe(true);
    }
  });

  it("is false for a button and for no target", () => {
    document.body.innerHTML = `<button id="e"></button>`;
    expect(isTypingTarget(document.getElementById("e"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
