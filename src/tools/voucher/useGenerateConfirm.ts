// What stands between the GENERATE! button and a run: the guard that says whether it may start, the
// confirmation question, and the start itself in the template's own pixels.
import { useState } from "react";
import { checkCanGenerate } from "./core/generateGuard";
import { toImagePixels, type Rect } from "./core/selection";
import type { CodeStyle } from "./core/drawVoucher";
import type { VoucherSettings } from "./core/voucherSettings";
import { templateBounds, type VoucherTemplate } from "./template";
import type { VoucherLook } from "./voucherImages";

interface GenerateConfirmOptions {
  settings: VoucherSettings;
  template: VoucherTemplate | null;
  selection: Rect | null;
  style: CodeStyle;
  connected: boolean;
  start(settings: VoucherSettings, look: VoucherLook): void;
}

export function useGenerateConfirm({
  settings,
  template,
  selection,
  style,
  connected,
  start,
}: GenerateConfirmOptions) {
  const [confirming, setConfirming] = useState(false);

  const check = checkCanGenerate({
    hasImage: template !== null,
    hasSelection: selection !== null,
    savePath: settings.savePath,
    prefix: settings.prefix,
    connected,
    appliesTo: settings.appliesTo,
    pickedCollectionCount: settings.collectionIds.length,
    startDate: settings.startDate,
    endDate: settings.endDate,
  });

  function confirm() {
    setConfirming(false);
    if (!check.canGenerate || template === null || selection === null) return;
    const area = toImagePixels(selection, templateBounds(template), template);
    start(settings, { template, area, style });
  }

  return {
    check,
    confirming,
    ask: () => setConfirming(true),
    cancel: () => setConfirming(false),
    confirm,
  };
}
