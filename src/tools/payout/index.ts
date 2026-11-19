import { lazy } from "react";
import type { ToolDefinition } from "../types";
import { PayoutIcon } from "./PayoutIcon";

export const payout: ToolDefinition = {
  id: "payout",
  name: "Payout",
  colour: "green",
  icon: PayoutIcon,
  component: lazy(() => import("./PayoutTool")),
  fileTypes: [],
};
