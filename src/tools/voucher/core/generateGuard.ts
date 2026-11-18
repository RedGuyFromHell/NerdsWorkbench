// Why the GENERATE button is disabled. The first missing thing wins, in this order.

export interface GenerateInputs {
  hasImage: boolean;
  hasSelection: boolean;
  savePath: string;
  prefix: string;
}

export type GenerateCheck = { canGenerate: true } | { canGenerate: false; reason: string };

export function checkCanGenerate(inputs: GenerateInputs): GenerateCheck {
  if (!inputs.hasImage) return blocked("upload a voucher image to continue");
  if (!inputs.hasSelection) return blocked("draw the discount code area on the preview");
  if (inputs.savePath.trim() === "") return blocked("set a save path");
  if (inputs.prefix.trim() === "") return blocked("set a discount code prefix");
  return { canGenerate: true };
}

function blocked(reason: string): GenerateCheck {
  return { canGenerate: false, reason };
}
