// Money as the screen shows it: lei with two decimals, a comma between thousands, a real minus sign.
// Digits are cut from the whole bani, so no float touches an amount on its way to the screen.

const BANI_PER_LEU = 100;
const MINUS_SIGN = "−";
const THOUSANDS_GAP = /\B(?=(\d{3})+(?!\d))/g;

/** 123456 gives "1,234.56"; -3409 gives "−34.09". Throws on a number that is not whole bani. */
export function formatLei(bani: number): string {
  if (!Number.isSafeInteger(bani)) {
    throw new Error(`An amount must be a whole number of bani, got ${bani}.`);
  }
  const magnitude = Math.abs(bani);
  const lei = Math.trunc(magnitude / BANI_PER_LEU);
  const hundredths = String(magnitude % BANI_PER_LEU).padStart(2, "0");
  const sign = bani < 0 ? MINUS_SIGN : "";
  return `${sign}${String(lei).replace(THOUSANDS_GAP, ",")}.${hundredths}`;
}
