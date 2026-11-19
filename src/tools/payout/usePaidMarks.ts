// The "Paid on" marks of the month on screen. Only a closed month takes them; they live in
// their own file, so a mark never rewrites a locked month.
import { useCallback, useState } from "react";
import type { PayoutStore } from "./storage/payoutStore";
import type { StoredPaidMarks } from "./storage/schemas";

/** What the totals panel needs to show and change the marks of one closed month. */
export interface PaidMarks {
  /** The day a person was paid, "yyyy-mm-dd", or null. */
  paidOnOf(personId: string): string | null;
  mark(personId: string, paidOn: string): void;
  clear(personId: string): void;
}

interface UsePaidMarksInput {
  store: PayoutStore;
  /** The closed month on screen, or null when the month shown is not closed. */
  closedMonth: string | null;
  marks: StoredPaidMarks["marks"];
  /** Called after every write, so the screen reads the marks again. */
  onSettled(): void;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function usePaidMarks({ store, closedMonth, marks, onSettled }: UsePaidMarksInput): {
  paid: PaidMarks | null;
  paidError: string | null;
} {
  const [paidError, setPaidError] = useState<string | null>(null);

  const run = useCallback(
    (write: Promise<void>) => {
      setPaidError(null);
      void write
        .catch((error: unknown) => {
          setPaidError(`The paid mark could not be saved: ${messageOf(error)}`);
        })
        .finally(onSettled);
    },
    [onSettled],
  );

  if (closedMonth === null) return { paid: null, paidError };
  const paid: PaidMarks = {
    paidOnOf: (personId) =>
      marks.find((mark) => mark.month === closedMonth && mark.personId === personId)?.paidOn ??
      null,
    mark: (personId, paidOn) => run(store.markPaid(closedMonth, personId, paidOn)),
    clear: (personId) => run(store.clearPaid(closedMonth, personId)),
  };
  return { paid, paidError };
}
