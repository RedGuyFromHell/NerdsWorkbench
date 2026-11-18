// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { ignoresKey, keyCommand, type KeyCommand, type KeyInput } from "./keys";

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

  it("is not a plain Z, and not Ctrl+Shift+Z", () => {
    expect(keyCommand(press("z"), true)).toBeNull();
    expect(keyCommand(press("Z", { ctrlKey: true, shiftKey: true }), true)).not.toEqual({
      type: "undo",
    });
  });
});

describe("redo", () => {
  it("is Ctrl+Shift+Z, Ctrl+Y or their Meta forms, with or without a selection", () => {
    expect(keyCommand(press("Z", { ctrlKey: true, shiftKey: true }), false)).toEqual({
      type: "redo",
    });
    expect(keyCommand(press("z", { metaKey: true, shiftKey: true }), true)).toEqual({
      type: "redo",
    });
    expect(keyCommand(press("y", { ctrlKey: true }), false)).toEqual({ type: "redo" });
    expect(keyCommand(press("Y", { metaKey: true }), true)).toEqual({ type: "redo" });
  });

  it("is not a plain Y", () => {
    expect(keyCommand(press("y"), true)).toBeNull();
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

describe("ignoresKey", () => {
  const undo: KeyCommand = { type: "undo" };
  const redo: KeyCommand = { type: "redo" };
  const remove: KeyCommand = { type: "delete" };
  const byId = (id: string) => document.getElementById(id);

  it("leaves undo and redo to the browser in a text field", () => {
    document.body.innerHTML = `<textarea id="a"></textarea><input id="b" type="text">`;
    for (const id of ["a", "b"]) {
      expect(ignoresKey(undo, byId(id))).toBe(true);
      expect(ignoresKey(redo, byId(id))).toBe(true);
    }
  });

  it("keeps undo and redo on a select, a checkbox and a colour input, which have no text undo", () => {
    document.body.innerHTML = `<select id="a"></select><input id="b" type="checkbox"><input id="c" type="color">`;
    for (const id of ["a", "b", "c"]) {
      expect(ignoresKey(undo, byId(id))).toBe(false);
      expect(ignoresKey(redo, byId(id))).toBe(false);
    }
  });

  it("ignores every other command on a select, a checkbox and a text field", () => {
    document.body.innerHTML = `<select id="a"></select><input id="b" type="checkbox"><input id="c">`;
    for (const id of ["a", "b", "c"]) {
      expect(ignoresKey(remove, byId(id))).toBe(true);
    }
  });

  it("ignores every command inside a dialog", () => {
    document.body.innerHTML = `<dialog open><button id="a"></button></dialog>`;
    for (const command of [undo, redo, remove]) {
      expect(ignoresKey(command, byId("a"))).toBe(true);
    }
  });

  it("ignores nothing on the page itself", () => {
    document.body.innerHTML = `<button id="a"></button>`;
    for (const command of [undo, redo, remove]) {
      expect(ignoresKey(command, byId("a"))).toBe(false);
    }
    expect(ignoresKey(undo, null)).toBe(false);
  });
});
