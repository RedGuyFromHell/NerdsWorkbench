import { lazy } from "react";
import type { ToolDefinition } from "../types";
import { DiscIcon } from "./DiscIcon";

// WHY: ".nerd" is routed by its "tool" field, so only the old extension is listed here.
export const discStudio: ToolDefinition = {
  id: "disc-studio",
  name: "Disc Studio",
  colour: "pink",
  icon: DiscIcon,
  component: lazy(() => import("./DiscStudio")),
  fileTypes: [{ extension: ".disc.json", label: "Disc Studio project (old)" }],
};
