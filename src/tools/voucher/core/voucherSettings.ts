// What the Voucher screen lets the user set, the values it starts with, and the small decisions on
// them. None of it is kept between runs.
import type { CodeStyle } from "./drawVoucher";

export interface VoucherSettings {
  fontFamily: string;
  fontSizePx: number;
  letterSpacingPx: number;
  outlineThicknessPx: number;
  codeColour: string;
  outlineColour: string;
  percentage: number;
  appliesTo: "all" | "collection";
  /** Collection GIDs; read only while `appliesTo` is "collection". */
  collectionIds: string[];
  /** 0 means no minimum. */
  minimumSubtotal: number;
  /** 0 means unlimited. */
  usageLimit: number;
  oncePerCustomer: boolean;
  /** Local dates as `yyyy-mm-dd`, as a date input holds them. */
  startDate: string;
  endDate: string;
  prefix: string;
  voucherCount: number;
  randomLength: number;
  numbersOnly: boolean;
  savePath: string;
}

export const DEFAULT_FONT_FAMILY = "Impact";
export const MAX_PREFIX_LENGTH = 20;

// Limits of the numeric fields, as the old settings panel set them.
export const FONT_SIZE_RANGE = { min: 8, max: 400 };
export const LETTER_SPACING_RANGE = { min: -10, max: 40 };
export const OUTLINE_RANGE = { min: 0, max: 20 };
export const PERCENTAGE_RANGE = { min: 1, max: 100 };
export const PERCENTAGE_DECIMALS = 2;
export const MINIMUM_SUBTOTAL_RANGE = { min: 0, max: 999999 };
export const USAGE_LIMIT_RANGE = { min: 0, max: 999999 };
export const VOUCHER_COUNT_RANGE = { min: 1, max: 100000 };
export const RANDOM_LENGTH_RANGE = { min: 1, max: 32 };

const DEFAULT_VALIDITY_DAYS = 30;

export function defaultVoucherSettings(today: Date): VoucherSettings {
  const end = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + DEFAULT_VALIDITY_DAYS,
  );
  return {
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSizePx: 42,
    letterSpacingPx: 2,
    outlineThicknessPx: 1,
    codeColour: "#4a265a",
    outlineColour: "#ffffff",
    percentage: 10,
    appliesTo: "all",
    collectionIds: [],
    minimumSubtotal: 0,
    usageLimit: 1,
    oncePerCustomer: true,
    startDate: formatLocalDate(today),
    endDate: formatLocalDate(end),
    prefix: "SUMMER-",
    voucherCount: 100,
    randomLength: 8,
    numbersOnly: false,
    savePath: "",
  };
}

/** `yyyy-mm-dd` of the date as it reads on the user's calendar. */
export function formatLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Codes are upper case and the prefix is at most 20 characters. */
export function normalisePrefix(text: string): string {
  return text.toUpperCase().slice(0, MAX_PREFIX_LENGTH);
}

/** The wanted family when the machine has it, else the first one it has. */
export function pickFontFamily(installed: readonly string[], wanted: string): string {
  if (installed.includes(wanted)) return wanted;
  return installed[0] ?? wanted;
}

export type CodeLook = Pick<
  VoucherSettings,
  | "fontFamily"
  | "fontSizePx"
  | "letterSpacingPx"
  | "outlineThicknessPx"
  | "codeColour"
  | "outlineColour"
>;

export function toCodeStyle(settings: CodeLook): CodeStyle {
  return {
    fontFamily: settings.fontFamily,
    fontSizePx: settings.fontSizePx,
    letterSpacingPx: settings.letterSpacingPx,
    colour: settings.codeColour,
    outlineColour: settings.outlineColour,
    outlineThicknessPx: settings.outlineThicknessPx,
  };
}
