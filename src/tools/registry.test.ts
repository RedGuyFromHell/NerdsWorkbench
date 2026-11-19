import { lazy } from "react";
import { describe, expect, it } from "vitest";
import { getTool, resolveToolForFile, TOOLS } from "./registry";
import type { FileType, ToolDefinition, ToolId } from "./types";

function fakeTool(id: ToolId, fileTypes: readonly FileType[]): ToolDefinition {
  return {
    id,
    name: id,
    colour: "pink",
    icon: () => null,
    component: lazy(() => Promise.resolve({ default: () => null })),
    fileTypes,
  };
}

describe("TOOLS", () => {
  it("lists Disc Studio (pink), the Voucher Generator (blue) then Payout (green)", () => {
    expect(TOOLS.map((tool) => [tool.id, tool.colour])).toEqual([
      ["disc-studio", "pink"],
      ["voucher", "blue"],
      ["payout", "green"],
    ]);
  });

  it("has unique ids", () => {
    const ids = TOOLS.map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getTool", () => {
  it("returns the tool with that id", () => {
    expect(getTool("voucher").name).toBe("Voucher Generator");
  });

  it("throws on an unknown id", () => {
    expect(() => getTool("nope" as ToolId)).toThrow("Unknown tool id: nope");
  });
});

describe("resolveToolForFile", () => {
  it("sends a .disc.json file to Disc Studio, whatever the case", () => {
    expect(resolveToolForFile("C:\\Users\\me\\My Design.disc.json")?.id).toBe("disc-studio");
    expect(resolveToolForFile("C:\\Users\\me\\My Design.DISC.JSON")?.id).toBe("disc-studio");
  });

  it("does not route a .nerd file by its extension", () => {
    expect(resolveToolForFile("C:\\Users\\me\\design.nerd")).toBeNull();
  });

  it("gives null for an extension no tool owns", () => {
    expect(resolveToolForFile("C:\\Users\\me\\notes.txt")).toBeNull();
    expect(resolveToolForFile("C:\\Users\\me\\data.json")).toBeNull();
  });

  it("prefers the longest matching extension", () => {
    const generic = fakeTool("voucher", [{ extension: ".json", label: "Any JSON" }]);
    const specific = fakeTool("disc-studio", [{ extension: ".disc.json", label: "Disc" }]);
    expect(resolveToolForFile("a.disc.json", [generic, specific])?.id).toBe("disc-studio");
    expect(resolveToolForFile("a.disc.json", [specific, generic])?.id).toBe("disc-studio");
    expect(resolveToolForFile("a.json", [specific, generic])?.id).toBe("voucher");
  });
});
