// Every colour the canvas drawing and the project defaults use. Canvas code cannot read CSS variables,
// so the values live here, named once.
// WHY: the values must match the parity reference (tests/disc-parity/reference/disc-studio.html)
// character for character; the parity test compares pixels, so a "nearly the same" colour fails it.

export const ZONE_TINT = "rgba(220,40,40,0.18)"; // the red tint where the mask gives no ink
export const GUIDE_CUT_COLOUR = "#e00";
export const GUIDE_SAFE_COLOUR = "#fff";
export const SELECTION_COLOUR = "#3aa0ff";
export const ERASER_PAINT_COLOUR = "#000"; // the eraser canvas only needs an opaque colour
export const BRUSH_OUTLINE_DARK = "#000";
export const BRUSH_OUTLINE_LIGHT = "#fff";

export const DEFAULT_TINT_COLOUR = "#111111"; // the recolour colour until the user picks one
export const DEFAULT_TEXT_COLOUR = "#1a1a1a";
export const DEFAULT_TEXT_OUTLINE_COLOUR = "#ffffff";
export const DEFAULT_PLA_COLOUR = "#f4f2ec";
export const DEFAULT_BACKGROUND_COLOUR = "#8a8a8a";
