import { describe, expect, it } from "vitest";
import { applyDownloadEvent, NO_PROGRESS, progressFraction } from "./progress";
import type { DownloadProgress } from "./progress";

describe("applyDownloadEvent", () => {
  it("starts with nothing downloaded and the total from the Started event", () => {
    const state = applyDownloadEvent(NO_PROGRESS, {
      event: "Started",
      data: { contentLength: 400 },
    });
    expect(state).toEqual({ downloaded: 0, total: 400 });
  });

  it("keeps the total unknown when Started has no content length", () => {
    const state = applyDownloadEvent(NO_PROGRESS, { event: "Started", data: {} });
    expect(state).toEqual({ downloaded: 0, total: null });
  });

  it("adds each chunk to the downloaded bytes", () => {
    let state: DownloadProgress = { downloaded: 0, total: 400 };
    state = applyDownloadEvent(state, { event: "Progress", data: { chunkLength: 100 } });
    state = applyDownloadEvent(state, { event: "Progress", data: { chunkLength: 150 } });
    expect(state).toEqual({ downloaded: 250, total: 400 });
  });

  it("sets downloaded to the total on Finished", () => {
    const state = applyDownloadEvent({ downloaded: 390, total: 400 }, { event: "Finished" });
    expect(state).toEqual({ downloaded: 400, total: 400 });
  });

  it("leaves an unknown total unknown on Finished", () => {
    const state = applyDownloadEvent({ downloaded: 390, total: null }, { event: "Finished" });
    expect(state).toEqual({ downloaded: 390, total: null });
  });
});

describe("progressFraction", () => {
  it("is downloaded divided by total", () => {
    expect(progressFraction({ downloaded: 100, total: 400 })).toBe(0.25);
  });

  it("is null while the total is unknown, never NaN", () => {
    expect(progressFraction({ downloaded: 100, total: null })).toBeNull();
  });

  it("is null for a total of zero, never NaN or Infinity", () => {
    expect(progressFraction({ downloaded: 0, total: 0 })).toBeNull();
  });

  it("never goes above 1 if a chunk overshoots", () => {
    expect(progressFraction({ downloaded: 450, total: 400 })).toBe(1);
  });
});
