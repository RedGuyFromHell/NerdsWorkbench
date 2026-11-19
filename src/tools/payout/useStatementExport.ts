// The PDF and CSV buttons of a closed month: builds the statement of one person from the
// locked month and their paid mark, then saves it where the user picks. An open month has no
// exporter, so it has no buttons.
import { useCallback, useState } from "react";
import { buildStatement } from "./core/statement";
import { exportStatement } from "./exportStatement";
import type { StatementFormat } from "./exportStatement";
import type { ClosedMonthFile } from "./storage/monthSchema";
import type { PaidMarks } from "./usePaidMarks";

export interface StatementExporter {
  /** True while a statement is being saved: a second one waits for it. */
  busy: boolean;
  run(personId: string, format: StatementFormat): void;
}

/** What the last export said, kept with its month so another month does not show it. */
export interface ExportNote {
  month: string;
  kind: "saved" | "error";
  text: string;
}

interface UseStatementExportInput {
  /** The month on screen when it is closed, else null. */
  closed: ClosedMonthFile | null;
  paid: PaidMarks | null;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useStatementExport({ closed, paid }: UseStatementExportInput): {
  exporter: StatementExporter | null;
  note: ExportNote | null;
} {
  const [busy, setBusy] = useState(false);
  const [lastNote, setLastNote] = useState<ExportNote | null>(null);

  const run = useCallback(
    (personId: string, format: StatementFormat) => {
      if (closed === null) return;
      const { month } = closed;
      setBusy(true);
      setLastNote(null);
      const work = async () => {
        const statement = buildStatement(closed, personId, paid?.paidOnOf(personId) ?? null);
        return exportStatement(statement, format);
      };
      work()
        .then((name) => {
          if (name !== null) setLastNote({ month, kind: "saved", text: `Saved ${name}.` });
        })
        .catch((error: unknown) => {
          const text = `The ${format.toUpperCase()} could not be saved: ${messageOf(error)}`;
          setLastNote({ month, kind: "error", text });
        })
        .finally(() => setBusy(false));
    },
    [closed, paid],
  );

  const note = lastNote !== null && lastNote.month === closed?.month ? lastNote : null;
  return { exporter: closed === null ? null : { busy, run }, note };
}
