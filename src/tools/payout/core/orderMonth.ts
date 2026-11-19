// The month an order belongs to, and the list of months the tool shows. A month is the text
// "YYYY-MM", in the time zone of the store: an order made at 01:00 on the first, store time, is
// of the new month even while UTC is still in the old one.

const MONTH_TEXT = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MONTHS_PER_YEAR = 12;

/** The count of months since year 0, so two months compare and step as plain numbers. */
function toMonthIndex(month: string): number {
  const match = MONTH_TEXT.exec(month);
  if (match?.[1] === undefined || match[2] === undefined) {
    throw new Error(`"${month}" is not a month (expected "YYYY-MM").`);
  }
  return Number(match[1]) * MONTHS_PER_YEAR + Number(match[2]) - 1;
}

function fromMonthIndex(monthIndex: number): string {
  const year = Math.floor(monthIndex / MONTHS_PER_YEAR);
  const monthOfYear = (monthIndex % MONTHS_PER_YEAR) + 1;
  return `${String(year).padStart(4, "0")}-${String(monthOfYear).padStart(2, "0")}`;
}

/**
 * The month of an instant in a time zone (an IANA name, for example "UTC").
 * Throws on a time or a zone it cannot read: an order must never fall in a made-up month.
 */
export function monthOf(createdAtIso: string, timeZone: string): string {
  const instant = new Date(createdAtIso);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`"${createdAtIso}" is not a time.`);
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(instant);
  const year = parts.find((part) => part.type === "year")?.value;
  const monthOfYear = parts.find((part) => part.type === "month")?.value;
  if (year === undefined || monthOfYear === undefined) {
    throw new Error(`No month for "${createdAtIso}" in ${timeZone}.`);
  }
  return `${year.padStart(4, "0")}-${monthOfYear}`;
}

/** Every month from the first to the last, both included, oldest first. Empty when the first is after the last. */
export function listMonths(firstMonth: string, lastMonth: string): string[] {
  const lastIndex = toMonthIndex(lastMonth);
  const months: string[] = [];
  for (let monthIndex = toMonthIndex(firstMonth); monthIndex <= lastIndex; monthIndex += 1) {
    months.push(fromMonthIndex(monthIndex));
  }
  return months;
}
