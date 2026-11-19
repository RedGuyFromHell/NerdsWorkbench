// Why the GENERATE button is disabled. The first missing thing wins, in this order: the four the old
// app checked, then the ones this app adds.

export interface GenerateInputs {
  hasImage: boolean;
  hasSelection: boolean;
  savePath: string;
  prefix: string;
  connected: boolean;
  appliesTo: "all" | "collection";
  pickedCollectionCount: number;
  /** Local dates as `yyyy-mm-dd`; empty when the date field was cleared. */
  startDate: string;
  endDate: string;
}

export type GenerateCheck = { canGenerate: true } | { canGenerate: false; reason: string };

export function checkCanGenerate(inputs: GenerateInputs): GenerateCheck {
  if (!inputs.hasImage) return blocked("upload a voucher image to continue");
  if (!inputs.hasSelection) return blocked("draw the discount code area on the preview");
  if (inputs.savePath.trim() === "") return blocked("set a save path");
  if (inputs.prefix.trim() === "") return blocked("set a discount code prefix");
  if (!inputs.connected) return blocked("not connected to Shopify");
  // WARNING: money. "Specific collections" with none picked was a discount on every product in
  // the old app. `buildDiscountInput` refuses it too; the screen says why before a run starts.
  if (inputs.appliesTo === "collection" && inputs.pickedCollectionCount === 0) {
    return blocked("discount applies to collections but none is picked");
  }
  // WHY: an empty date would reach Shopify as a broken timestamp, after the codes file is written.
  if (inputs.startDate === "") return blocked("set a start date");
  if (inputs.endDate === "") return blocked("set an end date");
  // `yyyy-mm-dd` dates sort as text. The same day is fine: the discount runs that whole day.
  if (inputs.endDate < inputs.startDate) return blocked("end date is before the start date");
  return { canGenerate: true };
}

function blocked(reason: string): GenerateCheck {
  return { canGenerate: false, reason };
}
