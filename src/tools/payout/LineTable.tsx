// The lines of a month, grouped by order: the two person menus per line, the tags under them, and
// a fold-out that shows how the line's money was worked out.
import { Select } from "../../ui/Select";
import { Tag } from "../../ui/Tag";
import { NO_PERSON } from "./core/choices";
import type { ChoicePart, MenuOption } from "./core/choices";
import type { LineRowView, OrderView, TagPlace, TagView } from "./core/monthView";

/** What a menu does when a person is picked. The empty choice is null. */
export type OnChoose = (lineId: string, part: ChoicePart, personId: string | null) => void;

const COLUMN_COUNT = 9;

function TagList({ tags, place }: { tags: readonly TagView[]; place: TagPlace }) {
  const shown = tags.filter((tag) => tag.place === place);
  if (shown.length === 0) return null;
  return (
    <span className="payout-tags">
      {shown.map((tag) => (
        <Tag key={tag.id} tone={tag.tone} title={tag.title}>
          {tag.label}
        </Tag>
      ))}
    </span>
  );
}

interface PersonCellProps {
  /** Names the menu for a screen reader: "Printed by, Product · Variant". */
  label: string;
  value: string;
  options: readonly MenuOption[];
  onPick(personId: string | null): void;
  readOnly: boolean;
  tags: readonly TagView[];
  place: TagPlace;
}

/** A menu. The tags of the cell sit under it, not beside it. */
function PersonCell({ label, value, options, onPick, readOnly, tags, place }: PersonCellProps) {
  return (
    <div className="payout-stack">
      <Select
        label={label}
        hideLabel
        value={value}
        options={options}
        disabled={readOnly}
        onChange={(picked) => onPick(picked === NO_PERSON ? null : picked)}
      />
      <TagList tags={tags} place={place} />
    </div>
  );
}

function nameOfLine(row: LineRowView): string {
  return row.variantTitle === "" ? row.productTitle : `${row.productTitle} · ${row.variantTitle}`;
}

/** "How we got this": the named steps of the maths. Closed until opened; a blocked line has none. */
function StepsRow({ row }: { row: LineRowView }) {
  if (row.steps.length === 0) return null;
  return (
    <tr className="payout-lines__steps">
      <td colSpan={COLUMN_COUNT}>
        <details>
          <summary>
            How we got this<span className="payout-sr-only"> for {nameOfLine(row)}</span>
          </summary>
          <dl className="payout-steps">
            {row.steps.map((step) => (
              <div className="payout-steps__row" key={step.label}>
                <dt>{step.label}</dt>
                <dd className="payout-num">{step.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      </td>
    </tr>
  );
}

interface LineRowProps {
  row: LineRowView;
  readOnly: boolean;
  onChoose: OnChoose;
}

function LineRow({ row, readOnly, onChoose }: LineRowProps) {
  const className =
    row.status === "blocked" ? "payout-lines__row payout-lines__row--blocked" : "payout-lines__row";
  return (
    <>
      <tr className={className}>
        <th scope="row" className="payout-lines__product">
          <span>{row.productTitle}</span>
          {row.variantTitle === "" ? null : (
            <span className="payout-muted"> · {row.variantTitle}</span>
          )}
          <TagList tags={row.tags} place="product" />
        </th>
        <td className="payout-num">{row.qty}</td>
        <td className="payout-num">{row.paid}</td>
        <td className="payout-num">{row.fee}</td>
        <td className="payout-num">{row.cost}</td>
        <td>
          <PersonCell
            label={`Printed by, ${nameOfLine(row)}`}
            value={row.printedValue}
            options={row.printedOptions}
            onPick={(personId) => onChoose(row.lineId, "printedBy", personId)}
            readOnly={readOnly}
            tags={row.tags}
            place="printed"
          />
        </td>
        <td>
          {row.hasPaintPart ? (
            <PersonCell
              label={`Painted by, ${nameOfLine(row)}`}
              value={row.paintedValue}
              options={row.paintedOptions}
              onPick={(personId) => onChoose(row.lineId, "paintedBy", personId)}
              readOnly={readOnly}
              tags={row.tags}
              place="painted"
            />
          ) : (
            <span className="payout-muted">no paint</span>
          )}
        </td>
        <td>
          <ul className="payout-owed">
            {row.owed.map((owed) => (
              <li key={owed.personId}>
                <span>{owed.name}</span> <span className="payout-num">{owed.amount}</span>
              </li>
            ))}
          </ul>
        </td>
        <td className="payout-num">{row.company}</td>
      </tr>
      <StepsRow row={row} />
    </>
  );
}

interface OrderRowsProps {
  order: OrderView;
  readOnly: boolean;
  onChoose: OnChoose;
}

function OrderRows({ order, readOnly, onChoose }: OrderRowsProps) {
  return (
    <tbody>
      <tr className="payout-lines__order">
        <th scope="rowgroup" colSpan={COLUMN_COUNT}>
          <div className="payout-lines__order-head">
            <span>
              {order.name} · {order.dateText}
            </span>
            {order.notPaidYet ? <Tag tone="warn">not paid yet</Tag> : null}
            {order.warning === null ? null : <Tag tone="danger">{order.warning}</Tag>}
          </div>
        </th>
      </tr>
      {order.lines.map((row) => (
        <LineRow key={row.lineId} row={row} readOnly={readOnly} onChoose={onChoose} />
      ))}
    </tbody>
  );
}

interface LineTableProps {
  title: string;
  orders: readonly OrderView[];
  /** A closed month: the menus are shown but cannot change. */
  readOnly: boolean;
  onChoose: OnChoose;
}

export function LineTable({ title, orders, readOnly, onChoose }: LineTableProps) {
  return (
    // WHY: a table that scrolls sideways must be reachable with the keyboard, so the region takes focus.
    <div className="payout-lines" role="region" aria-label={`Lines of ${title}`} tabIndex={0}>
      <table className="payout-lines__table">
        <caption className="payout-sr-only">
          Lines of {title}, grouped by order. Amounts in lei.
        </caption>
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col" className="payout-num">
              Qty
            </th>
            <th scope="col" className="payout-num">
              Paid
            </th>
            <th scope="col" className="payout-num">
              Fee
            </th>
            <th scope="col" className="payout-num">
              Cost
            </th>
            <th scope="col">Printed by</th>
            <th scope="col">Painted by</th>
            <th scope="col">Owed to</th>
            <th scope="col" className="payout-num">
              Company
            </th>
          </tr>
        </thead>
        {orders.map((order) => (
          <OrderRows key={order.orderId} order={order} readOnly={readOnly} onChoose={onChoose} />
        ))}
      </table>
    </div>
  );
}
