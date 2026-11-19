// The totals of a month: what each person is owed, what the company keeps, and the corrections
// the month carries. They change with every menu: the view is worked out again from the lines.
// A closed month adds "Mark as paid" and the PDF and CSV statement buttons under each person.
import { useId, useState } from "react";
import { Button } from "../../ui/Button";
import { Tag } from "../../ui/Tag";
import { CorrectionsBox } from "./CorrectionsBox";
import type { MonthView, PersonTotalView } from "./core/monthView";
import type { PaidMarks } from "./usePaidMarks";
import type { StatementExporter } from "./useStatementExport";

interface RowProps {
  label: string;
  value: string;
  strong?: boolean;
}

function Row({ label, value, strong = false }: RowProps) {
  const className = strong ? "payout-totals__row payout-totals__row--strong" : "payout-totals__row";
  return (
    <div className={className}>
      <dt>{label}</dt>
      <dd className="payout-num">{value}</dd>
    </div>
  );
}

const DATE_PART_LENGTH = 2;

/** Today on this PC, "yyyy-mm-dd": the day a date field starts on. */
function todayText(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(DATE_PART_LENGTH, "0");
  const day = String(now.getDate()).padStart(DATE_PART_LENGTH, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

interface PaidMarkProps {
  name: string;
  paidOn: string | null;
  onMark(paidOn: string): void;
  onClear(): void;
}

/** The paid mark of one person: the day it was paid, or a date and the button that marks it. */
function PaidMark({ name, paidOn, onMark, onClear }: PaidMarkProps) {
  const [date, setDate] = useState(todayText);
  const dateId = useId();
  if (paidOn !== null) {
    return (
      <div className="payout-paid">
        <Tag tone="good">paid</Tag>
        <span className="payout-paid__text">
          Paid on <time dateTime={paidOn}>{paidOn}</time>
        </span>
        <Button onClick={onClear}>
          Clear<span className="payout-sr-only"> the paid mark of {name}</span>
        </Button>
      </div>
    );
  }
  return (
    <div className="payout-paid">
      <label className="payout-paid__label" htmlFor={dateId}>
        Paid on<span className="payout-sr-only">, {name}</span>
      </label>
      <input
        id={dateId}
        type="date"
        className="input payout-paid__date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
      />
      <Button disabled={date === ""} onClick={() => onMark(date)}>
        Mark as paid<span className="payout-sr-only">, {name}</span>
      </Button>
    </div>
  );
}

interface StatementButtonsProps {
  name: string;
  exporter: StatementExporter;
  personId: string;
}

/** The statement of one person: a PDF to hand over and a CSV for a spreadsheet. */
function StatementButtons({ name, exporter, personId }: StatementButtonsProps) {
  return (
    <div className="payout-statement">
      <span className="payout-statement__label">Statement</span>
      <Button disabled={exporter.busy} onClick={() => exporter.run(personId, "pdf")}>
        PDF<span className="payout-sr-only"> statement of {name}</span>
      </Button>
      <Button disabled={exporter.busy} onClick={() => exporter.run(personId, "csv")}>
        CSV<span className="payout-sr-only"> statement of {name}</span>
      </Button>
    </div>
  );
}

interface PersonCardProps {
  person: PersonTotalView;
  paid: PaidMarks | null;
  exporter: StatementExporter | null;
}

function PersonCard({ person, paid, exporter }: PersonCardProps) {
  const headingId = `payout-total-${person.personId}`;
  return (
    <section className="payout-totals__card" aria-labelledby={headingId}>
      <h3 className="payout-totals__heading payout-totals__heading--person" id={headingId}>
        To pay · {person.name}
      </h3>
      <dl className="payout-totals__rows">
        <Row label="Print profit" value={person.print} />
        <Row label="Painting" value={person.paint} />
        <Row label="Drybrush" value={person.drybrush} />
        <Row label="Corrections" value={person.corrections} />
        <Row label="Total" value={person.total} strong />
      </dl>
      {exporter === null ? null : (
        <StatementButtons name={person.name} exporter={exporter} personId={person.personId} />
      )}
      {paid === null ? null : (
        <PaidMark
          name={person.name}
          paidOn={paid.paidOnOf(person.personId)}
          onMark={(paidOn) => paid.mark(person.personId, paidOn)}
          onClear={() => paid.clear(person.personId)}
        />
      )}
    </section>
  );
}

/** What the totals leave out or cannot yet pay, so they are not read as final. */
function TotalsNotes({ view }: { view: MonthView }) {
  const notes: string[] = [];
  if (view.blockedLines > 0) {
    notes.push(
      `${view.blockedLines} blocked ${view.blockedLines === 1 ? "line is" : "lines are"} not in these totals.`,
    );
  }
  if (view.needsChoiceLines > 0) {
    notes.push(
      `${view.needsChoiceLines} ${view.needsChoiceLines === 1 ? "line pays" : "lines pay"} nobody until a person is chosen.`,
    );
  }
  if (notes.length === 0) return null;
  return (
    <p className="payout-totals__note payout-muted" role="status">
      {notes.join(" ")}
    </p>
  );
}

interface TotalsPanelProps {
  view: MonthView;
  /** The paid marks of a closed month; null for an open one, which cannot be marked. */
  paid: PaidMarks | null;
  /** Saves a statement of a closed month; null for an open one, which has none. */
  exporter: StatementExporter | null;
}

export function TotalsPanel({ view, paid, exporter }: TotalsPanelProps) {
  return (
    <aside className="payout-totals" aria-label="Totals">
      <TotalsNotes view={view} />
      {view.people.map((person) => (
        <PersonCard key={person.personId} person={person} paid={paid} exporter={exporter} />
      ))}
      <section className="payout-totals__card" aria-labelledby="payout-total-company">
        <h3 className="payout-totals__heading" id="payout-total-company">
          Company keeps
        </h3>
        <dl className="payout-totals__rows">
          <Row label="Company total" value={view.company} strong />
          {view.companyCorrections === null ? null : (
            <Row label="Of which corrections" value={view.companyCorrections} />
          )}
          <Row label="Material and print cost" value={view.costs} />
          <Row label="Payment fees" value={view.fees} />
          <Row label="Paid by customers, without tax" value={view.paid} />
        </dl>
      </section>
      <CorrectionsBox corrections={view.corrections} />
    </aside>
  );
}
