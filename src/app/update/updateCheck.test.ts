import { describe, expect, it, vi } from "vitest";
import type { AvailableUpdate } from "./updateCheck";
import {
  checkResultMessage,
  installUpdate,
  runUpdateCheck,
  shouldCheckOnStart,
  startupNotice,
} from "./updateCheck";

function fakeUpdate(overrides: Partial<AvailableUpdate> = {}): AvailableUpdate {
  return {
    version: "0.5.1",
    notes: "Shows the version in the status bar.",
    downloadAndInstall: () => Promise.resolve(),
    ...overrides,
  };
}

describe("runUpdateCheck", () => {
  it("reports up to date when the checker finds nothing", async () => {
    expect(await runUpdateCheck(() => Promise.resolve(null))).toEqual({ kind: "up-to-date" });
  });

  it("reports the update when the checker finds one", async () => {
    const update = fakeUpdate();
    expect(await runUpdateCheck(() => Promise.resolve(update))).toEqual({
      kind: "available",
      update,
    });
  });

  it("turns a thrown Error into a failed result with its message", async () => {
    const result = await runUpdateCheck(() => Promise.reject(new Error("network down")));
    expect(result).toEqual({ kind: "failed", message: "network down" });
  });

  it("turns a thrown string into a failed result (the plugin rejects with strings)", async () => {
    const result = await runUpdateCheck(() => Promise.reject("could not fetch latest.json"));
    expect(result).toEqual({ kind: "failed", message: "could not fetch latest.json" });
  });
});

describe("checkResultMessage", () => {
  it("says the app is up to date", () => {
    expect(checkResultMessage({ kind: "up-to-date" })).toBe("Nerd's Workbench is up to date.");
  });

  it("names the version that was found", () => {
    expect(checkResultMessage({ kind: "available", update: fakeUpdate() })).toBe(
      "Version 0.5.1 is available.",
    );
  });

  it("says the check failed and why", () => {
    expect(checkResultMessage({ kind: "failed", message: "network down" })).toBe(
      "Could not check for updates: network down",
    );
  });
});

describe("startupNotice", () => {
  it("is quiet when up to date or when an update is found (the dialog speaks then)", () => {
    expect(startupNotice({ kind: "up-to-date" })).toBe("");
    expect(startupNotice({ kind: "available", update: fakeUpdate() })).toBe("");
  });

  it("is a short status bar line when the check failed", () => {
    expect(startupNotice({ kind: "failed", message: "network down" })).toBe(
      "Update check failed (offline?)",
    );
  });
});

describe("shouldCheckOnStart", () => {
  it("checks only inside the app and not in a dev build", () => {
    expect(shouldCheckOnStart({ inTauri: true, dev: false })).toBe(true);
    expect(shouldCheckOnStart({ inTauri: true, dev: true })).toBe(false);
    expect(shouldCheckOnStart({ inTauri: false, dev: false })).toBe(false);
  });
});

describe("installUpdate", () => {
  it("downloads with progress events, then relaunches", async () => {
    const calls: string[] = [];
    const update = fakeUpdate({
      downloadAndInstall: (onEvent) => {
        onEvent({ event: "Started", data: { contentLength: 10 } });
        onEvent({ event: "Progress", data: { chunkLength: 10 } });
        calls.push("installed");
        return Promise.resolve();
      },
    });
    const progress: unknown[] = [];
    await installUpdate(
      update,
      () => {
        calls.push("relaunched");
        return Promise.resolve();
      },
      (state) => progress.push(state),
    );
    expect(calls).toEqual(["installed", "relaunched"]);
    expect(progress).toEqual([
      { downloaded: 0, total: 10 },
      { downloaded: 10, total: 10 },
    ]);
  });

  it("does not relaunch when the download fails", async () => {
    const relaunch = vi.fn(() => Promise.resolve());
    const update = fakeUpdate({
      downloadAndInstall: () => Promise.reject(new Error("bad signature")),
    });
    await expect(installUpdate(update, relaunch, () => undefined)).rejects.toThrow("bad signature");
    expect(relaunch).not.toHaveBeenCalled();
  });
});
