import { describe, expect, it } from "vitest";
import { listMonths, monthOf } from "./orderMonth";

const AHEAD_OF_UTC = "Asia/Tokyo"; // UTC+9, no summer time
const BEHIND_UTC = "America/New_York"; // UTC-5 in winter, UTC-4 in summer

describe("monthOf", () => {
  it("puts 23:30 UTC on the last day of a month in the next month, for a zone ahead of UTC", () => {
    expect(monthOf("2031-03-31T23:30:00Z", AHEAD_OF_UTC)).toBe("2031-04");
    expect(monthOf("2031-03-31T23:30:00Z", "UTC")).toBe("2031-03");
  });

  it("puts 00:30 UTC on the first day of a month in the month before, for a zone behind UTC", () => {
    expect(monthOf("2031-04-01T00:30:00Z", BEHIND_UTC)).toBe("2031-03");
    expect(monthOf("2031-04-01T00:30:00Z", "UTC")).toBe("2031-04");
  });

  it("flips exactly at midnight of the store", () => {
    // Midnight in a UTC+9 zone is 15:00 UTC the day before.
    expect(monthOf("2031-06-30T14:59:59Z", AHEAD_OF_UTC)).toBe("2031-06");
    expect(monthOf("2031-06-30T15:00:00Z", AHEAD_OF_UTC)).toBe("2031-07");
  });

  it("crosses a year at the edge", () => {
    expect(monthOf("2031-12-31T20:00:00Z", AHEAD_OF_UTC)).toBe("2032-01");
    expect(monthOf("2032-01-01T03:00:00Z", BEHIND_UTC)).toBe("2031-12");
  });

  it("follows summer time", () => {
    // UTC-4 in summer: midnight is 04:00 UTC. UTC-5 in winter: midnight is 05:00 UTC.
    expect(monthOf("2031-07-01T03:59:00Z", BEHIND_UTC)).toBe("2031-06");
    expect(monthOf("2031-07-01T04:00:00Z", BEHIND_UTC)).toBe("2031-07");
    expect(monthOf("2031-02-01T04:30:00Z", BEHIND_UTC)).toBe("2031-01");
    expect(monthOf("2031-02-01T05:00:00Z", BEHIND_UTC)).toBe("2031-02");
  });

  it("reads a time written with an offset", () => {
    expect(monthOf("2031-04-01T01:30:00+03:00", "UTC")).toBe("2031-03");
  });

  it("throws on a time it cannot read", () => {
    expect(() => monthOf("not a date", "UTC")).toThrow();
    expect(() => monthOf("", "UTC")).toThrow();
  });

  it("throws on a time zone that does not exist", () => {
    expect(() => monthOf("2031-04-01T00:30:00Z", "Nowhere/Land")).toThrow();
  });
});

describe("listMonths", () => {
  it("lists every month from the first to the last, oldest first", () => {
    expect(listMonths("2031-11", "2032-02")).toEqual(["2031-11", "2031-12", "2032-01", "2032-02"]);
  });

  it("lists one month when both ends are the same", () => {
    expect(listMonths("2031-05", "2031-05")).toEqual(["2031-05"]);
  });

  it("lists nothing when the first month is after the last", () => {
    expect(listMonths("2031-06", "2031-05")).toEqual([]);
  });

  it("throws on a month it cannot read", () => {
    expect(() => listMonths("2031-13", "2032-02")).toThrow();
    expect(() => listMonths("2031-00", "2032-02")).toThrow();
    expect(() => listMonths("2031-1", "2032-02")).toThrow();
    expect(() => listMonths("2031-01", "2032-02-01")).toThrow();
  });
});
