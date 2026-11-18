// Which tool a file opens in. Pure: the page reads the file, this decides.
// A .nerd file is routed by its "tool" field (one extension serves every tool); an old .disc.json
// file is routed by its extension through the registry.
import { fileNameOf } from "../lib/files";
import { getTool, resolveToolForFile } from "../tools/registry";
import type { ToolId } from "../tools/types";

export type RouteResult = { ok: true; toolId: ToolId } | { ok: false; message: string };

const PROJECT_EXTENSION = ".nerd";

/** The top-level "tool" field of a project file's text (undefined when there is none). */
export function toolFieldOf(text: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("This file is not a valid project file.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
  return (parsed as Record<string, unknown>).tool;
}

/** The tool for this path, given the file's "tool" field (read it only for a .nerd file). */
export function routeOpenFile(path: string, toolField: unknown): RouteResult {
  const name = fileNameOf(path);
  if (path.toLowerCase().endsWith(PROJECT_EXTENSION)) {
    if (typeof toolField !== "string") {
      return { ok: false, message: `${name} does not say which tool it belongs to.` };
    }
    try {
      return { ok: true, toolId: getTool(toolField as ToolId).id };
    } catch {
      return {
        ok: false,
        message: `${name} belongs to a tool this app does not have ("${toolField}").`,
      };
    }
  }
  const tool = resolveToolForFile(path);
  if (!tool) return { ok: false, message: `${name} is not a file Nerd's Workbench can open.` };
  return { ok: true, toolId: tool.id };
}
