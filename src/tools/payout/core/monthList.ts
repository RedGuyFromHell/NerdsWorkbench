// The months list on the left of the tool: every month from the first month in Settings up to the
// current one, plus any month that has a file, newest first. A month with no file is "not loaded".

import { listMonths } from "./orderMonth";
import { formatMonthShort } from "./monthView";

export type MonthEntryStatus = "open" | "closed" | "not-loaded";

export interface MonthEntry {
  month: string;
  label: string;
  status: MonthEntryStatus;
}

interface MonthListInput {
  /** "YYYY-MM", or an empty text while Settings has none. */
  firstMonth: string;
  currentMonth: string;
  /** The months that have a file, with the status written in it. */
  files: readonly { month: string; status: "open" | "closed" }[];
}

export function buildMonthList({ firstMonth, currentMonth, files }: MonthListInput): MonthEntry[] {
  const statusByMonth = new Map(files.map((file) => [file.month, file.status]));
  const range = firstMonth === "" ? [] : listMonths(firstMonth, currentMonth);
  const months = new Set([...range, ...statusByMonth.keys()]);
  return [...months]
    .sort()
    .reverse()
    .map((month) => ({
      month,
      label: formatMonthShort(month),
      status: statusByMonth.get(month) ?? "not-loaded",
    }));
}
