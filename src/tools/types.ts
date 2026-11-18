// The tool registry's shapes. Adding a tool is a folder plus one line in registry.ts.
import type { ComponentType, LazyExoticComponent } from "react";

export type ToolId = "disc-studio" | "voucher" | "payout";

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

/** What the shell runs when the user asks to save a tool's unsaved work. */
export interface UnsavedWork {
  /** Saves the work. True when it is safe on disk; false when the user cancelled or it failed (the tool has already shown why). Never throws. */
  save(): Promise<boolean>;
}

export interface ToolContext {
  openRequest: OpenRequest | null;
  setStatus(text: string): void;
  /** Call with the save action while the tool holds work that is not saved, and with null when it does not. */
  setUnsavedWork(work: UnsavedWork | null): void;
  /** Opens the app's Settings window with the section of this id in view. */
  openSettings(sectionId: string): void;
}

export interface ToolDefinition {
  id: ToolId;
  name: string;
  colour: ToolColour;
  icon: ComponentType<{ size: number }>;
  component: LazyExoticComponent<ComponentType<ToolContext>>;
  fileTypes: readonly FileType[];
}
