// The last look before a live run: GENERATE! opens this window, and only its Create button starts
// the run. Cancel, Escape and the close box do nothing.
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { describeRun } from "./core/runSummary";
import type { VoucherSettings } from "./core/voucherSettings";

interface ConfirmRunDialogProps {
  settings: VoucherSettings;
  onConfirm(): void;
  onCancel(): void;
}

export function ConfirmRunDialog({ settings, onConfirm, onCancel }: ConfirmRunDialogProps) {
  return (
    <Dialog
      title="Create this discount?"
      onClose={onCancel}
      actions={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={onConfirm}>
            Create in Shopify
          </Button>
        </>
      }
    >
      <p>This creates a live discount in your Shopify store.</p>
      <dl className="voucher-confirm">
        {describeRun(settings).map(({ label, value }) => (
          <div key={label} className="voucher-confirm__line">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
