// The list of tools the home grid shows, and the lookups that route a file or an id to a tool.
import { discStudio } from "./disc-studio";
import { payout } from "./payout";
import type { ToolDefinition, ToolId } from "./types";
import { voucher } from "./voucher";

export const TOOLS: readonly ToolDefinition[] = [discStudio, voucher, payout];

export function getTool(id: ToolId, tools: readonly ToolDefinition[] = TOOLS): ToolDefinition {
  const tool = tools.find((candidate) => candidate.id === id);
  if (!tool) throw new Error(`Unknown tool id: ${id}`);
  return tool;
}

/**
 * The tool that owns this file's extension, or null.
 * WHY: ".nerd" is deliberately not matched here. One extension serves every tool, so a ".nerd"
 * file is routed by the "tool" field inside it (through getTool), not by its name.
 */
export function resolveToolForFile(
  path: string,
  tools: readonly ToolDefinition[] = TOOLS,
): ToolDefinition | null {
  const lowerPath = path.toLowerCase();
  let best: { tool: ToolDefinition; length: number } | null = null;
  for (const tool of tools) {
    for (const { extension } of tool.fileTypes) {
      const isLonger = best === null || extension.length > best.length;
      if (lowerPath.endsWith(extension) && isLonger) best = { tool, length: extension.length };
    }
  }
  return best ? best.tool : null;
}
