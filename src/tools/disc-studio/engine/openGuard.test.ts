import { describe, expect, it } from "vitest";
import { stepAfterChoice, stepBeforeOpening } from "./openGuard";

describe("stepBeforeOpening", () => {
  it("opens at once when nothing is unsaved", () => {
    expect(stepBeforeOpening(false)).toBe("open");
  });

  it("asks first when the design has unsaved changes", () => {
    expect(stepBeforeOpening(true)).toBe("ask");
  });
});

describe("stepAfterChoice", () => {
  it("opens after Save when the file was written", () => {
    expect(stepAfterChoice("save", true)).toBe("open");
  });

  it("stops after Save when the save was cancelled or failed", () => {
    expect(stepAfterChoice("save", false)).toBe("stop");
  });

  it("opens after Don't save, whatever the save result says", () => {
    expect(stepAfterChoice("skip", false)).toBe("open");
  });

  it("stops after Cancel, even if a save had been written", () => {
    expect(stepAfterChoice("cancel", false)).toBe("stop");
    expect(stepAfterChoice("cancel", true)).toBe("stop");
  });
});
