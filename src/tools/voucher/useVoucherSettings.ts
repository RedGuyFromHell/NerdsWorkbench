// The settings the user edits, and the two things drawn from them: the sample code and the look of
// the code. The settings are not kept between runs.
import { useCallback, useEffect, useMemo, useState } from "react";
import { generateCodes } from "./core/codeGen";
import {
  defaultVoucherSettings,
  pickFontFamily,
  toCodeStyle,
  type VoucherSettings,
} from "./core/voucherSettings";

// WHY: the sample changes only when something that shapes the code changes, so the font, size and
// colour can be judged on the same letters.
function makeSample(prefix: string, length: number, numbersOnly: boolean): string {
  return generateCodes({ prefix, length, count: 1, numbersOnly })[0] ?? prefix;
}

export function useVoucherSettings(fontFamilies: readonly string[]) {
  const [settings, setSettings] = useState(() => defaultVoucherSettings(new Date()));

  const change = useCallback((patch: Partial<VoucherSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  // The default font is Impact; a machine without it gets its first font, never a silent fallback.
  useEffect(() => {
    if (fontFamilies.length === 0) return;
    setSettings((current) => {
      const fontFamily = pickFontFamily(fontFamilies, current.fontFamily);
      return fontFamily === current.fontFamily ? current : { ...current, fontFamily };
    });
  }, [fontFamilies]);

  const { prefix, randomLength, numbersOnly } = settings;
  const sample = useMemo(
    () => makeSample(prefix, randomLength, numbersOnly),
    [prefix, randomLength, numbersOnly],
  );

  // WHY: only the look of the code, so typing in another field does not redraw the template.
  const { fontFamily, fontSizePx, letterSpacingPx, outlineThicknessPx } = settings;
  const { codeColour, outlineColour } = settings;
  const style = useMemo(
    () =>
      toCodeStyle({
        fontFamily,
        fontSizePx,
        letterSpacingPx,
        outlineThicknessPx,
        codeColour,
        outlineColour,
      }),
    [fontFamily, fontSizePx, letterSpacingPx, outlineThicknessPx, codeColour, outlineColour],
  );

  return { settings, change, sample, style };
}
