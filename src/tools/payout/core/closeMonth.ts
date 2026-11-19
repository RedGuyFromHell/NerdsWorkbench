// Closing a month: the check that it may close, and the file it becomes. Pure: the caller gives
// the time and writes the file. A closed file holds the settings and people as used, every result
// and the totals, so nothing ever works it out again.

import { readAmounts, storeResult, storeTotals } from "../storage/amountCodec";
import type { ClosedMonthFile, MonthFile } from "../storage/monthSchema";
import type { PayoutSettings, StoredPeople } from "../storage/schemas";
import { listMissingChoices } from "./choices";
import type { MonthEntryStatus } from "./monthList";
import { sumMonth } from "./monthTotals";
import { calculateLine } from "./payoutMath";
import type { LineResult, OkLineResult } from "./types";

// #region Shapes
/** One thing that keeps a month from closing. */
export type CloseBlocker =
  | { kind: "already-closed" }
  | { kind: "blocked-lines"; count: number }
  | { kind: "needs-choice"; count: number }
  | { kind: "older-month-open"; month: string };

export type ClosePlan =
  { kind: "refused"; blockers: CloseBlocker[] } | { kind: "ready"; closed: ClosedMonthFile };

export interface CloseInput {
  file: MonthFile;
  /** The live settings and people: they are frozen into the closed file. */
  settings: PayoutSettings;
  people: StoredPeople;
  /** Every month the tool lists. Only the ones before `file.month` are looked at. */
  months: readonly { month: string; status: MonthEntryStatus }[];
  /** The instant of the close, ISO 8601. */
  closedAt: string;
}
// #endregion

function isOkResult(result: LineResult): result is OkLineResult {
  return result.status === "ok";
}

function listBlockers(
  { file, people, months }: CloseInput,
  results: readonly LineResult[],
): CloseBlocker[] {
  if (file.status === "closed") return [{ kind: "already-closed" }];
  const blockers: CloseBlocker[] = [];
  // WHY: months close oldest first, so a correction always has one month to go to. A month
  // that was never loaded is not closed either.
  for (const older of months) {
    if (older.month < file.month && older.status !== "closed") {
      blockers.push({ kind: "older-month-open", month: older.month });
    }
  }
  const blocked = results.filter((result) => result.status === "blocked").length;
  if (blocked > 0) blockers.push({ kind: "blocked-lines", count: blocked });
  const needsChoice = file.lines.filter(
    (line) => listMissingChoices(line, people.people).length > 0,
  ).length;
  if (needsChoice > 0) blockers.push({ kind: "needs-choice", count: needsChoice });
  return blockers;
}

/**
 * The closed file of a month, or what keeps it open: a blocked line, an empty menu, an older
 * month that is not closed. Writes nothing.
 */
export function planClose(input: CloseInput): ClosePlan {
  const { file, settings, people, closedAt } = input;
  const results = file.lines.map((line) =>
    calculateLine(
      { ...line.facts, printedBy: line.printedBy, paintedBy: line.paintedBy },
      settings.rates,
      people.people,
    ),
  );
  const blockers = listBlockers(input, results);
  const okResults = results.filter(isOkResult);
  if (blockers.length > 0 || file.status === "closed" || okResults.length !== results.length) {
    return { kind: "refused", blockers };
  }
  const corrections = file.corrections ?? [];
  const totals = sumMonth(
    okResults,
    corrections.map((correction) => readAmounts(correction.amounts)),
  );
  return {
    kind: "ready",
    closed: {
      version: file.version,
      month: file.month,
      status: "closed",
      timeZone: file.timeZone,
      loadedAt: file.loadedAt,
      lines: structuredClone(file.lines),
      corrections: structuredClone(corrections),
      closedAt,
      settings: structuredClone({
        rates: settings.rates,
        rule: settings.rule,
        costTable: settings.costTable,
      }),
      people: structuredClone(people.people),
      results: file.lines.map((line, index) => {
        const result = okResults[index];
        if (result === undefined) throw new Error(`Line ${line.lineId} has no result.`);
        return { lineId: line.lineId, result: storeResult(result) };
      }),
      totals: storeTotals(totals),
    },
  };
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** A blocker as a sentence for the Close dialog. `titleOf` turns "2031-02" into the month's name. */
export function describeBlocker(blocker: CloseBlocker, titleOf: (month: string) => string): string {
  switch (blocker.kind) {
    case "already-closed":
      return "The month is already closed.";
    case "blocked-lines":
      return `${blocker.count} ${plural(blocker.count, "line is", "lines are")} blocked: the maths cannot work ${plural(blocker.count, "it", "them")} out yet.`;
    case "needs-choice":
      return `${blocker.count} ${plural(blocker.count, "line needs", "lines need")} a person chosen for Printed by or Painted by.`;
    case "older-month-open":
      return `${titleOf(blocker.month)} is not closed. Months close oldest first.`;
  }
}
