import { Button } from "../../../ui/Button";
import { addCostRow, removeCostRow, type CostRowDraft } from "./settingsForm";

interface CostTableProps {
  rows: CostRowDraft[];
  onChange(rows: CostRowDraft[]): void;
}

type TextColumn = keyof CostRowDraft;

const COLUMNS: readonly { column: TextColumn; heading: string; narrow: boolean }[] = [
  { column: "productTitle", heading: "Product title", narrow: false },
  { column: "sizeValue", heading: "Size value (blank: every size)", narrow: false },
  { column: "costText", heading: "Cost per piece, lei", narrow: true },
];

/** The cost used when the shop has no Cost per item. A row for one size wins over a row for every size. */
export function CostTable({ rows, onChange }: CostTableProps) {
  function change(index: number, column: TextColumn, value: string) {
    onChange(rows.map((row, position) => (position === index ? { ...row, [column]: value } : row)));
  }

  return (
    <>
      {rows.length === 0 ? null : (
        <table className="payout-table">
          <thead>
            <tr>
              {COLUMNS.map(({ column, heading }) => (
                <th key={column} scope="col">
                  {heading}
                </th>
              ))}
              <th scope="col">
                <span className="payout-table__sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {COLUMNS.map(({ column, heading, narrow }) => (
                  <td key={column}>
                    <input
                      type="text"
                      className={narrow ? "input input--mono payout-table__money" : "input"}
                      aria-label={`${heading}, cost row ${index + 1}`}
                      value={row[column]}
                      onChange={(event) => change(index, column, event.target.value)}
                    />
                  </td>
                ))}
                <td>
                  <Button
                    aria-label={`Remove cost row ${index + 1}`}
                    onClick={() => onChange(removeCostRow(rows, index))}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div>
        <Button onClick={() => onChange(addCostRow(rows))}>+ Add cost row</Button>
      </div>
      <p className="payout-settings__hint">
        Shopify's Cost per item wins. A painted piece uses the cost of its Primed &amp; Drybrushed
        variant. Paints are the painter's.
      </p>
    </>
  );
}
