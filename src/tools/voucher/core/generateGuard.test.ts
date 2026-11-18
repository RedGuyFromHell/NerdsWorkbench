import { describe, expect, it } from "vitest";
import { checkCanGenerate, type GenerateInputs } from "./generateGuard";

const READY: GenerateInputs = {
  hasImage: true,
  hasSelection: true,
  savePath: "C:\\Vouchers",
  prefix: "SUMMER-",
};

describe("checkCanGenerate", () => {
  it("allows a run when everything is set", () => {
    expect(checkCanGenerate(READY)).toEqual({ canGenerate: true });
  });

  it("asks for an image first, even when everything else is missing too", () => {
    expect(
      checkCanGenerate({ hasImage: false, hasSelection: false, savePath: "", prefix: "" }),
    ).toEqual({ canGenerate: false, reason: "upload a voucher image to continue" });
  });

  it("asks for the code area second", () => {
    expect(checkCanGenerate({ ...READY, hasSelection: false, savePath: "", prefix: "" })).toEqual({
      canGenerate: false,
      reason: "draw the discount code area on the preview",
    });
  });

  it("asks for a save path third", () => {
    expect(checkCanGenerate({ ...READY, savePath: "", prefix: "" })).toEqual({
      canGenerate: false,
      reason: "set a save path",
    });
  });

  it("asks for a prefix last", () => {
    expect(checkCanGenerate({ ...READY, prefix: "" })).toEqual({
      canGenerate: false,
      reason: "set a discount code prefix",
    });
  });

  it("treats a save path or a prefix of only spaces as empty", () => {
    expect(checkCanGenerate({ ...READY, savePath: "   " })).toEqual({
      canGenerate: false,
      reason: "set a save path",
    });
    expect(checkCanGenerate({ ...READY, prefix: " \t " })).toEqual({
      canGenerate: false,
      reason: "set a discount code prefix",
    });
  });
});
