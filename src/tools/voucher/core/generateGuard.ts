// Why the GENERATE button is disabled. The first missing thing wins, in this order: the four the old
// app checked, then the two this app adds.

export interface GenerateInputs {
  hasImage: boolean;
  hasSelection: boolean;
  savePath: string;
  prefix: string;
  connected: boolean;
  appliesTo: "all" | "collection";
  pickedCollectionCount: number;
}

export type GenerateCheck = { canGenerate: true } | { canGenerate: false; reason: string };

export function checkCanGenerate(inputs: GenerateInputs): GenerateCheck {
  if (!inputs.hasImage) return blocked("upload a voucher image to continue");
  if (!inputs.hasSelection) return blocked("draw the discount code area on the preview");
  if (inputs.savePath.trim() === "") return blocked("set a save path");
  if (inputs.prefix.trim() === "") return blocked("set a discount code prefix");
  if (!inputs.connected) return blocked("not connected to Shopify");
  // WARNING: money. `buildDiscountInput` turns "specific collections" with none picked into a
  // discount on every product, so the screen must never let that run.
  if (inputs.appliesTo === "collection" && inputs.pickedCollectionCount === 0) {
    return blocked("discount applies to collections but none is picked");
  }
  return { canGenerate: true };
}

function blocked(reason: string): GenerateCheck {
  return { canGenerate: false, reason };
}
