import { describe, expect, it } from "vitest";
import { leavesToolOnKey, sideButtonDirection, type EscapeInput } from "./shellInput";

describe("sideButtonDirection", () => {
  it("maps button 3 to back and button 4 to forward", () => {
    expect(sideButtonDirection(3)).toBe("back");
    expect(sideButtonDirection(4)).toBe("forward");
  });

  it("ignores left, middle and right, and any other number", () => {
    for (const button of [0, 1, 2, 5, -1]) {
      expect(sideButtonDirection(button)).toBeNull();
    }
  });
});

const plainEscape: EscapeInput = {
  key: "Escape",
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  repeat: false,
  isComposing: false,
  defaultPrevented: false,
  onTool: true,
  dialogOpen: false,
  typing: false,
};

describe("leavesToolOnKey", () => {
  it("is true for a plain Escape on a tool", () => {
    expect(leavesToolOnKey(plainEscape)).toBe(true);
  });

  it("is false for any other key", () => {
    expect(leavesToolOnKey({ ...plainEscape, key: "Enter" })).toBe(false);
    expect(leavesToolOnKey({ ...plainEscape, key: "Backspace" })).toBe(false);
  });

  it("is false on the home screen", () => {
    expect(leavesToolOnKey({ ...plainEscape, onTool: false })).toBe(false);
  });

  it("is false with a dialog open", () => {
    expect(leavesToolOnKey({ ...plainEscape, dialogOpen: true })).toBe(false);
  });

  it("is false in a typing target", () => {
    expect(leavesToolOnKey({ ...plainEscape, typing: true })).toBe(false);
  });

  it("is false with a modifier", () => {
    for (const modifier of ["ctrlKey", "altKey", "shiftKey", "metaKey"] as const) {
      expect(leavesToolOnKey({ ...plainEscape, [modifier]: true })).toBe(false);
    }
  });

  it("is false on a repeat and while composing", () => {
    expect(leavesToolOnKey({ ...plainEscape, repeat: true })).toBe(false);
    expect(leavesToolOnKey({ ...plainEscape, isComposing: true })).toBe(false);
  });

  it("is false when a tool already handled the key", () => {
    expect(leavesToolOnKey({ ...plainEscape, defaultPrevented: true })).toBe(false);
  });
});
