// The tool registry's shapes. Adding a tool is a folder plus one line in registry.ts.
import type { ComponentType, LazyExoticComponent } from "react";

export type ToolId = "disc-studio" | "voucher";

/** A colour token name from styles/tokens.css, never a raw hex. */
export type ToolColour = "pink" | "blue" | "yellow" | "green";

export interface FileType {
  /** Lower case, with the dot. Longest match wins: ".disc.json" before ".json". */
  extension: string;
  label: string; // "Disc Studio project"
}

export interface OpenRequest {
  path: string;
  /** Changes on every request, so opening the same file twice still reaches the tool. */
  nonce: number;
}

export interface ToolContext {
  openRequest: OpenRequest | null;
  setStatus(text: string): void;
}

export interface ToolDefinition {
  id: ToolId;
  name: string;
  colour: ToolColour;
  icon: ComponentType<{ size: number }>;
  component: LazyExoticComponent<ComponentType<ToolContext>>;
  fileTypes: readonly FileType[];
}
