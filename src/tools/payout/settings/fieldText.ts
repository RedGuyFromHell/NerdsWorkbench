// How the text typed into a Settings › Payout field becomes a value, and back. Percents become
// basis points and amounts become whole bani, read digit by digit so no float touches money.
import { toMatchKey } from "../core/matchText";
import { percentToBasisPoints } from "../core/percent";

const BANI_PER_LEU = 100;
// WHY: nine digits keep the bani count far below the largest exact whole number.
const MONEY_TEXT = /^(\d{1,9})(?:[.,](\d{1,2}))?$/;
const COMMA = ",";
const DOT = ".";
const LINE_BREAK = /\r?\n/;

/**
 * Basis points of a typed percent from 0 to 100, or null. A single comma is read as the decimal
 * mark, since a Romanian keyboard types one. Only the first comma is swapped, so "1,000.5" and
 * "1,5,5" still leave two separators and are refused.
 */
export function parsePercentText(text: string): number | null {
  return percentToBasisPoints(text.replace(COMMA, DOT));
}

/** Whole bani of a typed amount in lei with at most 2 decimals, or null. */
export function parseMoneyText(text: string): number | null {
  const match = MONEY_TEXT.exec(text.trim());
  if (match?.[1] === undefined) return null;
  const hundredths = (match[2] ?? "").padEnd(2, "0");
  return Number(match[1]) * BANI_PER_LEU + Number(hundredths);
}

/** The shortest text for an amount: 1200 gives "12", 1250 gives "12.50", 5 gives "0.05". */
export function formatBaniText(bani: number): string {
  const whole = Math.floor(bani / BANI_PER_LEU);
  const hundredths = bani % BANI_PER_LEU;
  if (hundredths === 0) return String(whole);
  return `${whole}.${String(hundredths).padStart(2, "0")}`;
}

/** The entries of a list, each once: the first spelling of a repeat wins. */
function uniqueByMatchKey(entries: readonly string[]): string[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = toMatchKey(entry);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** "mini, Figurine" gives ["mini", "figurine"]: comma separated, trimmed, lower case, no blanks or repeats. */
export function parseTagList(text: string): string[] {
  const tags = text
    .split(COMMA)
    .map(toMatchKey)
    .filter((tag) => tag !== "");
  return uniqueByMatchKey(tags);
}

export function formatTagList(tags: readonly string[]): string {
  return tags.join(", ");
}

/** One entry per line, for titles that may hold a comma. The spelling is kept. */
export function parseLineList(text: string): string[] {
  const lines = text
    .split(LINE_BREAK)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  return uniqueByMatchKey(lines);
}
