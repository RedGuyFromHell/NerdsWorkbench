import { lazy } from "react";
import type { ToolDefinition } from "../types";
import { VoucherIcon } from "./VoucherIcon";

export const voucher: ToolDefinition = {
  id: "voucher",
  name: "Voucher Generator",
  colour: "blue",
  icon: VoucherIcon,
  component: lazy(() => import("./VoucherTool")),
  fileTypes: [],
};
