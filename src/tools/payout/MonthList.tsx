// The months on the left. A month is a button: Enter or Space picks it, like a click.
import { Tag } from "../../ui/Tag";
import type { TagTone } from "../../ui/Tag";
import type { MonthEntry, MonthEntryStatus } from "./core/monthList";

const STATUS_TEXT: Record<MonthEntryStatus, string> = {
  open: "open",
  closed: "closed",
  "not-loaded": "not loaded",
};

const STATUS_TONE: Record<MonthEntryStatus, TagTone> = {
  open: "warn",
  closed: "good",
  "not-loaded": "plain",
};

interface MonthListProps {
  entries: readonly MonthEntry[];
  selected: string | null;
  onSelect(month: string): void;
  /** The first month of Settings as text, "" when it is not set. */
  firstMonthText: string;
}

export function MonthList({ entries, selected, onSelect, firstMonthText }: MonthListProps) {
  return (
    <nav className="payout-months" aria-label="Months">
      <h2 className="payout-months__heading">Months</h2>
      {entries.length === 0 ? (
        <p className="payout-months__note">No months yet.</p>
      ) : (
        <ul className="payout-months__list">
          {entries.map((entry) => (
            <li key={entry.month}>
              <button
                type="button"
                className="payout-months__item"
                aria-current={entry.month === selected ? "true" : undefined}
                onClick={() => onSelect(entry.month)}
              >
                <span className="payout-months__label">{entry.label}</span>
                <Tag tone={STATUS_TONE[entry.status]}>{STATUS_TEXT[entry.status]}</Tag>
              </button>
            </li>
          ))}
        </ul>
      )}
      {firstMonthText === "" ? null : (
        <p className="payout-months__note">Months before {firstMonthText} are not in the tool.</p>
      )}
    </nav>
  );
}
