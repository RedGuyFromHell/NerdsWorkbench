// Section 02 of the settings panel: what the discount is. Needs the Shopify connection for the
// collection list and, later, for the discount itself, so it carries the "Not connected" notice.
import { Button } from "../../ui/Button";
import { Checkbox } from "../../ui/Checkbox";
import { DateField } from "../../ui/DateField";
import { NumberField } from "../../ui/NumberField";
import { SectionHeader } from "../../ui/SectionHeader";
import { Select } from "../../ui/Select";
import type { CollectionsState } from "./useCollections";
import {
  MINIMUM_SUBTOTAL_RANGE,
  PERCENTAGE_RANGE,
  USAGE_LIMIT_RANGE,
  type VoucherSettings,
} from "./core/voucherSettings";

export type ShopifyConnection =
  | { kind: "checking" }
  | { kind: "failed"; message: string }
  | { kind: "disconnected" }
  | { kind: "connected" };

interface DiscountSectionProps {
  settings: VoucherSettings;
  onChange(patch: Partial<VoucherSettings>): void;
  connection: ShopifyConnection;
  collections: CollectionsState;
  onOpenSettings(): void;
}

const VOUCHER_TYPES = [{ value: "percentage", label: "Percentage Off Order" }];
const APPLIES_TO = [
  { value: "all", label: "All Products" },
  { value: "collection", label: "Specific Collections" },
];

function ConnectionNotice({
  connection,
  onOpenSettings,
}: Pick<DiscountSectionProps, "connection" | "onOpenSettings">) {
  if (connection.kind === "connected") return null;
  if (connection.kind === "checking") {
    return <p className="voucher-notice">Checking the Shopify connection...</p>;
  }
  if (connection.kind === "failed") {
    return (
      <p className="voucher-notice" role="alert">
        {connection.message}
      </p>
    );
  }
  return (
    <div className="voucher-notice">
      <p>Not connected - open Settings</p>
      <Button variant="primary" onClick={onOpenSettings}>
        Open Settings
      </Button>
    </div>
  );
}

function CollectionPicker({
  collections,
  pickedIds,
  onChange,
}: {
  collections: CollectionsState;
  pickedIds: readonly string[];
  onChange(ids: string[]): void;
}) {
  if (collections.step === "failed") {
    return (
      <p className="voucher-notice" role="alert">
        Could not load the collections: {collections.message}
      </p>
    );
  }
  if (collections.step !== "loaded") {
    return (
      <p className="voucher-hint">
        {collections.step === "loading"
          ? "Loading the collections..."
          : "Connect to Shopify to pick collections."}
      </p>
    );
  }
  const toggle = (id: string, picked: boolean) =>
    onChange(picked ? [...pickedIds, id] : pickedIds.filter((pickedId) => pickedId !== id));
  return (
    <>
      <ul className="voucher-collections" aria-label="Collections">
        {collections.collections.map((collection) => (
          <li key={collection.id}>
            <Checkbox
              label={collection.title}
              checked={pickedIds.includes(collection.id)}
              onChange={(picked) => toggle(collection.id, picked)}
            />
          </li>
        ))}
      </ul>
      <p className="voucher-hint">{pickedIds.length} picked</p>
    </>
  );
}

export function DiscountSection({
  settings,
  onChange,
  connection,
  collections,
  onOpenSettings,
}: DiscountSectionProps) {
  return (
    <section className="voucher-section">
      <SectionHeader number={2} title="Discount Settings" />
      <ConnectionNotice connection={connection} onOpenSettings={onOpenSettings} />
      {/* The old app had one voucher type; the box stays so a second one has a place. */}
      <Select
        label="Voucher Type"
        value="percentage"
        options={VOUCHER_TYPES}
        onChange={() => {}}
        disabled
      />
      <div className="voucher-pair">
        <NumberField
          label="Percentage"
          hint="%"
          value={settings.percentage}
          onChange={(percentage) => onChange({ percentage })}
          {...PERCENTAGE_RANGE}
        />
        <Select
          label="Applies To"
          value={settings.appliesTo}
          options={APPLIES_TO}
          onChange={(value) =>
            onChange({ appliesTo: value === "collection" ? "collection" : "all" })
          }
        />
      </div>
      {settings.appliesTo === "collection" ? (
        <CollectionPicker
          collections={collections}
          pickedIds={settings.collectionIds}
          onChange={(collectionIds) => onChange({ collectionIds })}
        />
      ) : null}
      <div className="voucher-pair">
        <NumberField
          label="Min. Order"
          hint="RON, 0 = none"
          value={settings.minimumSubtotal}
          onChange={(minimumSubtotal) => onChange({ minimumSubtotal })}
          {...MINIMUM_SUBTOTAL_RANGE}
        />
        <NumberField
          label="Usage Limit"
          hint="0 = unlimited"
          value={settings.usageLimit}
          onChange={(usageLimit) => onChange({ usageLimit })}
          {...USAGE_LIMIT_RANGE}
        />
      </div>
      <Checkbox
        label="Once per customer"
        checked={settings.oncePerCustomer}
        onChange={(oncePerCustomer) => onChange({ oncePerCustomer })}
      />
      <div className="voucher-pair">
        <DateField
          label="Start Date"
          value={settings.startDate}
          onChange={(startDate) => onChange({ startDate })}
        />
        <DateField
          label="End Date"
          value={settings.endDate}
          onChange={(endDate) => onChange({ endDate })}
        />
      </div>
    </section>
  );
}
