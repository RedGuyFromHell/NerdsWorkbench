// The question before a month closes, or the list of what keeps it open. Closing cannot be
// undone, so it never happens on one click.
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { describeBlocker } from "./core/closeMonth";
import type { ClosePlan } from "./core/closeMonth";
import { formatMonthTitle } from "./core/monthView";

interface CloseMonthDialogProps {
  /** The month's name, "March 2031". */
  title: string;
  plan: ClosePlan;
  onCancel(): void;
  onConfirm(): void;
}

export function CloseMonthDialog({ title, plan, onCancel, onConfirm }: CloseMonthDialogProps) {
  if (plan.kind === "refused") {
    return (
      <Dialog
        title={`${title} cannot close yet`}
        colour="green"
        onClose={onCancel}
        actions={<Button onClick={onCancel}>OK</Button>}
      >
        <p>Fix this first:</p>
        <ul className="payout-dialog-list">
          {plan.blockers.map((blocker) => (
            <li key={blocker.kind === "older-month-open" ? blocker.month : blocker.kind}>
              {describeBlocker(blocker, formatMonthTitle)}
            </li>
          ))}
        </ul>
      </Dialog>
    );
  }
  return (
    <Dialog
      title={`Close ${title}?`}
      colour="green"
      onClose={onCancel}
      actions={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={onConfirm}>
            Close month
          </Button>
        </>
      }
    >
      <p>
        Closing locks the month. Every line, the choices, the settings and the people are saved as
        they are now, and nothing in it is changed or worked out again.
      </p>
      <p>A refund that comes later becomes a correction in the next open month.</p>
      <p>
        <strong>This cannot be undone.</strong>
      </p>
    </Dialog>
  );
}
