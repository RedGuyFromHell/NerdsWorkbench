// What the confirm window lists before a live run: the things that cost money or cannot be undone
// from this app, read from the same settings the run is started with.
import { formatMinimumSubtotal } from "../shopify/discountInput";
import type { VoucherSettings } from "./voucherSettings";

export interface RunSummaryLine {
  label: string;
  value: string;
}

// The shop's currency, as the Min. Order field labels it.
const CURRENCY = "RON";

export function describeRun(settings: VoucherSettings): RunSummaryLine[] {
  const { minimumSubtotal, usageLimit } = settings;
  return [
    { label: "Codes", value: `${settings.voucherCount}, starting with ${settings.prefix}` },
    { label: "Discount", value: `${settings.percentage} % off` },
    { label: "Applies to", value: describeAppliesTo(settings) },
    {
      label: "Min. order",
      value: minimumSubtotal > 0 ? `${formatMinimumSubtotal(minimumSubtotal)} ${CURRENCY}` : "none",
    },
    { label: "Usage limit", value: usageLimit > 0 ? `${usageLimit} per code` : "unlimited" },
    { label: "Starts", value: settings.startDate },
    { label: "Ends", value: settings.endDate },
    { label: "Save folder", value: settings.savePath },
  ];
}

function describeAppliesTo({ appliesTo, collectionIds }: VoucherSettings): string {
  if (appliesTo === "all") return "all products";
  return collectionIds.length === 1 ? "1 collection" : `${collectionIds.length} collections`;
}
