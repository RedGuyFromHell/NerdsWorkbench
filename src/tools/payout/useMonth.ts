// The month the screen shows, with its two menus. A choice shows at once, then is written to the
// month file and to the remembered choices, one write after the other, through the store only.
// Closing the month goes through the same line of writes, so it lands after every choice.
import { useCallback, useMemo, useRef, useState } from "react";
import { applyChoice } from "./core/choices";
import type { ChoicePart } from "./core/choices";
import { buildMonthView } from "./core/monthView";
import type { MonthView } from "./core/monthView";
import { saveChoice } from "./saveChoice";
import type { PayoutStore } from "./storage/payoutStore";
import { monthFileSchema } from "./storage/monthSchema";
import type { ClosedMonthFile, MonthFile } from "./storage/monthSchema";
import type { PayoutSettings, StoredPeople } from "./storage/schemas";

interface UseMonthInput {
  file: MonthFile | null;
  settings: PayoutSettings;
  people: StoredPeople;
  /** The app's store, or the memory store of the dev-only demo. */
  store: PayoutStore;
  /** Called when every write has ended, so the screen reads the files again. */
  onSettled(): void;
}

export interface UseMonth {
  /** The month as shown: the file read, with the choices not yet written. */
  file: MonthFile | null;
  view: MonthView | null;
  /** Null is the empty choice. Does nothing for a closed month. */
  choose(lineId: string, part: ChoicePart, personId: string | null): void;
  /** Writes the closed file planClose made, after the choices still on their way. */
  close(closed: ClosedMonthFile): void;
  saveError: string | null;
}

/** An edit of the file that was shown. It is dropped as soon as a different file arrives (a reload). */
interface Draft {
  base: MonthFile;
  file: MonthFile;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useMonth({ file, settings, people, store, onSettled }: UseMonthInput): UseMonth {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const current = draft !== null && draft.base === file ? draft.file : file;

  const view = useMemo(
    () => (current === null ? null : buildMonthView(current, settings, people)),
    [current, settings, people],
  );

  /** One write after the other. `what` names the write in the message of a failure. */
  const enqueue = useCallback(
    (what: string, write: () => Promise<void>) => {
      pending.current += 1;
      queue.current = queue.current
        .then(write)
        .catch((error: unknown) => {
          // WHY: what is on screen is no longer what is saved, so go back to the file as read.
          setSaveError(`${what} could not be saved: ${messageOf(error)}`);
          setDraft(null);
        })
        .finally(() => {
          pending.current -= 1;
          if (pending.current === 0) onSettled();
        });
    },
    [onSettled],
  );

  const choose = useCallback(
    (lineId: string, part: ChoicePart, personId: string | null) => {
      if (current === null || current.status === "closed") return;
      const lines = applyChoice(current.lines, lineId, part, personId);
      const next = { ...current, lines };
      setDraft({ base: file ?? current, file: next });
      setSaveError(null);
      const productId = current.lines.find((line) => line.lineId === lineId)?.productId ?? null;
      enqueue("The choice", () => saveChoice(store, next, productId, part, personId));
    },
    [current, file, store, enqueue],
  );

  const close = useCallback(
    (closed: ClosedMonthFile) => {
      setSaveError(null);
      enqueue("The closed month", () => store.writeMonth(closed.month, monthFileSchema, closed));
    },
    [store, enqueue],
  );

  return { file: current, view, choose, close, saveError };
}
