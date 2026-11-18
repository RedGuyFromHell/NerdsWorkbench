import { describe, expect, it } from "vitest";
import {
  back,
  currentScreen,
  forward,
  MAX_SCREEN_ENTRIES,
  startHistory,
  visit,
  type ScreenHistory,
} from "./screenHistory";

describe("startHistory", () => {
  it("is the home screen alone", () => {
    expect(startHistory).toEqual({ entries: ["home"], index: 0 });
    expect(currentScreen(startHistory)).toBe("home");
  });
});

describe("visit", () => {
  it("adds the screen after the current one and makes it current", () => {
    const next = visit(startHistory, "voucher");
    expect(next).toEqual({ entries: ["home", "voucher"], index: 1 });
    expect(currentScreen(next)).toBe("voucher");
  });

  it("returns the same object for the screen that is already current", () => {
    const history = visit(startHistory, "voucher");
    expect(visit(history, "voucher")).toBe(history);
    expect(visit(startHistory, "home")).toBe(startHistory);
  });

  it("drops the forward entries, as a browser does", () => {
    const tool = visit(startHistory, "voucher");
    const backHome = back(tool);
    const other = visit(backHome, "disc-studio");
    expect(other).toEqual({ entries: ["home", "disc-studio"], index: 1 });
  });

  it("keeps the newest 50 entries and the index on the last one", () => {
    let history: ScreenHistory = startHistory;
    for (let i = 0; i < 60; i += 1) {
      history = visit(history, i % 2 === 0 ? "voucher" : "home");
    }
    expect(MAX_SCREEN_ENTRIES).toBe(50);
    expect(history.entries).toHaveLength(50);
    expect(history.index).toBe(49);
    // 60 visits alternate voucher, home, ...: the last one is home.
    expect(currentScreen(history)).toBe("home");
    expect(history.entries[48]).toBe("voucher");
  });
});

describe("back and forward", () => {
  it("return the same object at the start and at the end", () => {
    expect(back(startHistory)).toBe(startHistory);
    const history = visit(startHistory, "voucher");
    expect(forward(history)).toBe(history);
  });

  it("walk home, tool, home, back, back, forward like a browser", () => {
    let history = visit(startHistory, "voucher"); // home > voucher
    history = visit(history, "home"); // home > voucher > home
    history = back(history); // on voucher
    expect(currentScreen(history)).toBe("voucher");
    history = back(history); // on the first home
    expect(currentScreen(history)).toBe("home");
    expect(history.index).toBe(0);
    history = forward(history);
    expect(currentScreen(history)).toBe("voucher");
    expect(history.entries).toEqual(["home", "voucher", "home"]);
  });
});
