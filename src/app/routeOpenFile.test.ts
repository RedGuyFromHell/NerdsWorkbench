import { describe, expect, it } from "vitest";
import { routeOpenFile, toolFieldOf } from "./routeOpenFile";

describe("toolFieldOf", () => {
  it("reads the top-level tool field of a project file", () => {
    expect(toolFieldOf('{"tool":"disc-studio","version":1}')).toBe("disc-studio");
  });

  it("gives undefined when there is no tool field", () => {
    expect(toolFieldOf('{"version":1}')).toBeUndefined();
    expect(toolFieldOf("[1,2]")).toBeUndefined();
    expect(toolFieldOf("42")).toBeUndefined();
  });

  it("throws a clear message for text that is not JSON", () => {
    expect(() => toolFieldOf("not json at all")).toThrow("This file is not a valid project file.");
  });
});

describe("routeOpenFile", () => {
  it("routes a .nerd file by its tool field, whatever the case of the extension", () => {
    expect(routeOpenFile("C:\\Users\\me\\design.nerd", "disc-studio")).toEqual({
      ok: true,
      toolId: "disc-studio",
    });
    expect(routeOpenFile("C:\\Users\\me\\VOUCHERS.NERD", "voucher")).toEqual({
      ok: true,
      toolId: "voucher",
    });
  });

  it("refuses a .nerd file whose tool is unknown", () => {
    expect(routeOpenFile("C:\\Users\\me\\design.nerd", "nope")).toEqual({
      ok: false,
      message: 'design.nerd belongs to a tool this app does not have ("nope").',
    });
  });

  it("refuses a .nerd file with no usable tool field", () => {
    const message = "design.nerd does not say which tool it belongs to.";
    expect(routeOpenFile("C:\\Users\\me\\design.nerd", undefined)).toEqual({ ok: false, message });
    expect(routeOpenFile("C:\\Users\\me\\design.nerd", 7)).toEqual({ ok: false, message });
  });

  it("routes an old .disc.json file by its extension, ignoring any tool field", () => {
    expect(routeOpenFile("C:\\Users\\me\\old.disc.json", undefined)).toEqual({
      ok: true,
      toolId: "disc-studio",
    });
  });

  it("refuses an extension no tool owns", () => {
    expect(routeOpenFile("/home/me/notes.txt", undefined)).toEqual({
      ok: false,
      message: "notes.txt is not a file Nerd's Workbench can open.",
    });
    expect(routeOpenFile("C:\\Users\\me\\data.json", undefined)).toEqual({
      ok: false,
      message: "data.json is not a file Nerd's Workbench can open.",
    });
  });
});
