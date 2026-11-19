import { describe, expect, it } from "vitest";
import { buildMonthList } from "./monthList";

describe("buildMonthList", () => {
  it("lists every month from the first to the current one, newest first", () => {
    expect(buildMonthList({ firstMonth: "2031-01", currentMonth: "2031-03", files: [] })).toEqual([
      { month: "2031-03", label: "Mar 2031", status: "not-loaded" },
      { month: "2031-02", label: "Feb 2031", status: "not-loaded" },
      { month: "2031-01", label: "Jan 2031", status: "not-loaded" },
    ]);
  });

  it("takes the status of a month from its file", () => {
    const list = buildMonthList({
      firstMonth: "2030-12",
      currentMonth: "2031-02",
      files: [
        { month: "2030-12", status: "closed" },
        { month: "2031-01", status: "open" },
      ],
    });
    expect(list.map((entry) => [entry.month, entry.status])).toEqual([
      ["2031-02", "not-loaded"],
      ["2031-01", "open"],
      ["2030-12", "closed"],
    ]);
  });

  it("shows a month that has a file even when it is outside the range", () => {
    const list = buildMonthList({
      firstMonth: "2031-02",
      currentMonth: "2031-03",
      files: [{ month: "2029-11", status: "open" }],
    });
    expect(list.map((entry) => entry.month)).toEqual(["2031-03", "2031-02", "2029-11"]);
  });

  it("lists only the files while the first month is not set", () => {
    expect(buildMonthList({ firstMonth: "", currentMonth: "2031-03", files: [] })).toEqual([]);
    const list = buildMonthList({
      firstMonth: "",
      currentMonth: "2031-03",
      files: [{ month: "2031-01", status: "open" }],
    });
    expect(list.map((entry) => entry.month)).toEqual(["2031-01"]);
  });

  it("lists nothing from the range when the first month is after the current one", () => {
    expect(buildMonthList({ firstMonth: "2031-06", currentMonth: "2031-03", files: [] })).toEqual(
      [],
    );
  });

  it("crosses a year", () => {
    const list = buildMonthList({ firstMonth: "2030-11", currentMonth: "2031-02", files: [] });
    expect(list.map((entry) => entry.month)).toEqual(["2031-02", "2031-01", "2030-12", "2030-11"]);
  });
});
