import { describe, expect, it } from "vitest";
import { askNext, nextExitStep, planExit } from "./exitGuard";

describe("planExit: leaving a screen", () => {
  it("asks nothing when the tool being left has no unsaved work", () => {
    expect(planExit({ kind: "leave", from: "voucher", to: "home" }, ["disc-studio"])).toEqual([]);
  });

  it("asks about the tool being left when it has unsaved work", () => {
    expect(planExit({ kind: "leave", from: "disc-studio", to: "home" }, ["disc-studio"])).toEqual([
      "disc-studio",
    ]);
  });

  it("asks nothing when leaving the home screen, whatever is open", () => {
    expect(planExit({ kind: "leave", from: "home", to: "disc-studio" }, ["disc-studio"])).toEqual(
      [],
    );
  });

  it("asks nothing for a move to the same tool", () => {
    expect(
      planExit({ kind: "leave", from: "disc-studio", to: "disc-studio" }, ["disc-studio"]),
    ).toEqual([]);
  });

  it("asks only about the tool being left, not about another one with unsaved work", () => {
    expect(
      planExit({ kind: "leave", from: "voucher", to: "disc-studio" }, ["disc-studio", "voucher"]),
    ).toEqual(["voucher"]);
  });
});

describe("planExit: closing the window", () => {
  it("asks nothing when no tool has unsaved work", () => {
    expect(planExit({ kind: "close", on: "disc-studio" }, [])).toEqual([]);
  });

  it("asks about every tool with unsaved work", () => {
    expect(planExit({ kind: "close", on: "home" }, ["disc-studio", "voucher"])).toEqual([
      "disc-studio",
      "voucher",
    ]);
  });

  it("asks about the tool on screen first", () => {
    expect(planExit({ kind: "close", on: "voucher" }, ["disc-studio", "voucher"])).toEqual([
      "voucher",
      "disc-studio",
    ]);
  });

  it("keeps the given order when the screen is home or a clean tool", () => {
    expect(planExit({ kind: "close", on: "home" }, ["voucher", "disc-studio"])).toEqual([
      "voucher",
      "disc-studio",
    ]);
  });
});

describe("askNext", () => {
  it("proceeds when nothing is left to ask", () => {
    expect(askNext([])).toEqual({ kind: "proceed" });
  });

  it("asks about the first tool and remembers the whole list", () => {
    expect(askNext(["disc-studio", "voucher"])).toEqual({
      kind: "ask",
      tool: "disc-studio",
      pending: ["disc-studio", "voucher"],
    });
  });
});

describe("nextExitStep", () => {
  it("moves on to the next tool after a save", () => {
    expect(nextExitStep(["disc-studio", "voucher"], "saved")).toEqual({
      kind: "ask",
      tool: "voucher",
      pending: ["voucher"],
    });
  });

  it("moves on to the next tool after Don't save", () => {
    expect(nextExitStep(["disc-studio", "voucher"], "skipped")).toEqual({
      kind: "ask",
      tool: "voucher",
      pending: ["voucher"],
    });
  });

  it("proceeds after the last tool was saved or skipped", () => {
    expect(nextExitStep(["voucher"], "saved")).toEqual({ kind: "proceed" });
    expect(nextExitStep(["voucher"], "skipped")).toEqual({ kind: "proceed" });
  });

  it("aborts on Cancel at any position", () => {
    expect(nextExitStep(["disc-studio", "voucher"], "cancelled")).toEqual({ kind: "abort" });
    expect(nextExitStep(["voucher"], "cancelled")).toEqual({ kind: "abort" });
  });

  it("aborts when a save failed or its dialog was cancelled, at any position", () => {
    expect(nextExitStep(["disc-studio", "voucher"], "saveFailed")).toEqual({ kind: "abort" });
    expect(nextExitStep(["voucher"], "saveFailed")).toEqual({ kind: "abort" });
  });
});
