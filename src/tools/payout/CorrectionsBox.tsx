// The corrections a month carries: refunds and cancellations that landed after their own month
// closed, with what each takes from every person and from the company.
import type { CorrectionView } from "./core/monthView";

const HEADING_ID = "payout-corrections-heading";

export function CorrectionsBox({ corrections }: { corrections: readonly CorrectionView[] }) {
  if (corrections.length === 0) return null;
  return (
    <section className="payout-totals__card payout-corrections" aria-labelledby={HEADING_ID}>
      <h3 className="payout-totals__heading" id={HEADING_ID}>
        Corrections from closed months
      </h3>
      <ul className="payout-corrections__list">
        {corrections.map((correction) => (
          <li className="payout-corrections__item" key={correction.id}>
            <p>
              <strong>{correction.title}</strong>
            </p>
            <p className="payout-muted">{correction.text}</p>
            <dl className="payout-totals__rows">
              {correction.people.map((person) => (
                <div className="payout-totals__row" key={person.personId}>
                  <dt>{person.name}</dt>
                  <dd className="payout-num">{person.amount}</dd>
                </div>
              ))}
              <div className="payout-totals__row">
                <dt>Company</dt>
                <dd className="payout-num">{correction.company}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
