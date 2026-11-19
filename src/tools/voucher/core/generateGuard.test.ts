import { describe, expect, it } from "vitest";
import { checkCanGenerate, type GenerateInputs } from "./generateGuard";

const READY: GenerateInputs = {
  hasImage: true,
  hasSelection: true,
  savePath: "C:\\Vouchers",
  prefix: "SUMMER-",
  connected: true,
  appliesTo: "all",
  pickedCollectionCount: 0,
};

describe("checkCanGenerate", () => {
  it("allows a run when everything is set", () => {
    expect(checkCanGenerate(READY)).toEqual({ canGenerate: true });
  });

  it("asks for an image first, even when everything else is missing too", () => {
    expect(
      checkCanGenerate({
        ...READY,
        hasImage: false,
        hasSelection: false,
        savePath: "",
        prefix: "",
        connected: false,
      }),
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

  it("asks for the Shopify connection after the four things the old app asked for", () => {
    expect(checkCanGenerate({ ...READY, connected: false })).toEqual({
      canGenerate: false,
      reason: "not connected to Shopify",
    });
    expect(checkCanGenerate({ ...READY, connected: false, prefix: "" })).toEqual({
      canGenerate: false,
      reason: "set a discount code prefix",
    });
  });

  // WARNING: this is money. A discount for specific collections with none picked would be built
  // as a discount on every product.
  it("blocks a discount for specific collections when none is picked", () => {
    expect(checkCanGenerate({ ...READY, appliesTo: "collection" })).toEqual({
      canGenerate: false,
      reason: "discount applies to collections but none is picked",
    });
  });

  it("asks for the connection before the collections", () => {
    expect(checkCanGenerate({ ...READY, appliesTo: "collection", connected: false })).toEqual({
      canGenerate: false,
      reason: "not connected to Shopify",
    });
  });

  it("allows specific collections once one is picked, and all products with none", () => {
    expect(
      checkCanGenerate({ ...READY, appliesTo: "collection", pickedCollectionCount: 1 }),
    ).toEqual({ canGenerate: true });
    expect(checkCanGenerate({ ...READY, appliesTo: "all", pickedCollectionCount: 0 })).toEqual({
      canGenerate: true,
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
