// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { isInsideDialog, isTextEntryTarget, isTypingTarget } from "./keyTargets";

const byId = (id: string) => document.getElementById(id);

describe("isTypingTarget", () => {
  it("is true for a field, and for anything inside a dialog", () => {
    document.body.innerHTML = `<input id="a"><textarea id="b"></textarea><select id="c"></select>
      <dialog open><button id="d"></button></dialog><button id="e"></button>`;
    for (const id of ["a", "b", "c", "d"]) {
      expect(isTypingTarget(byId(id))).toBe(true);
    }
  });

  it("is false for a button and for no target", () => {
    document.body.innerHTML = `<button id="e"></button>`;
    expect(isTypingTarget(byId("e"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("isTextEntryTarget", () => {
  it("is true for a textarea, a text-like input and editable content", () => {
    document.body.innerHTML = `<textarea id="a"></textarea><input id="b"><input id="c" type="text">
      <input id="d" type="number"><input id="e" type="search"><div id="f" contenteditable="true"><b id="g"></b></div>`;
    for (const id of ["a", "b", "c", "d", "e", "f", "g"]) {
      expect(isTextEntryTarget(byId(id))).toBe(true);
    }
  });

  it("is false for a select, a checkbox, a colour input, a range and a button", () => {
    document.body.innerHTML = `<select id="a"></select><input id="b" type="checkbox">
      <input id="c" type="color"><input id="d" type="range"><button id="e"></button>
      <div id="f" contenteditable="false"></div>`;
    for (const id of ["a", "b", "c", "d", "e", "f"]) {
      expect(isTextEntryTarget(byId(id))).toBe(false);
    }
  });

  it("is false for no target", () => {
    expect(isTextEntryTarget(null)).toBe(false);
  });
});

describe("isInsideDialog", () => {
  it("is true for the dialog and what it holds, false elsewhere", () => {
    document.body.innerHTML = `<dialog open id="a"><button id="b"></button></dialog><button id="c"></button>`;
    expect(isInsideDialog(byId("a"))).toBe(true);
    expect(isInsideDialog(byId("b"))).toBe(true);
    expect(isInsideDialog(byId("c"))).toBe(false);
    expect(isInsideDialog(null)).toBe(false);
  });
});
