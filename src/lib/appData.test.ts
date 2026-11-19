import { describe, expect, it } from "vitest";
import { listAppFiles, readAppText, writeAppText } from "./appData";

// The tests run in Node, where there is no Tauri window: every call must fail with the one clear
// message, not with a missing-module error.
describe("the app data calls outside the desktop app", () => {
  it("each throw that app data is only in the desktop app", async () => {
    await expect(readAppText("payout/settings.json")).rejects.toThrow("desktop app");
    await expect(writeAppText("payout/settings.json", "{}")).rejects.toThrow("desktop app");
    await expect(listAppFiles("payout/months")).rejects.toThrow("desktop app");
  });
});
