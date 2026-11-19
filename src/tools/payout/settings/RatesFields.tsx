import { Field } from "../../../ui/Field";
import type { SettingsDraft } from "./settingsForm";

interface RatesFieldsProps {
  draft: SettingsDraft;
  onChange(draft: SettingsDraft): void;
}

/** The three rates and the first month. Percents may be typed with a dot or a comma. */
export function RatesFields({ draft, onChange }: RatesFieldsProps) {
  return (
    <div className="payout-settings__grid">
      <div className="payout-settings__cell">
        <Field
          label="Printer's share"
          hint="%"
          value={draft.splitText}
          onChange={(splitText) => onChange({ ...draft, splitText })}
        />
        <p className="payout-settings__hint">Of the print profit. The company keeps the rest.</p>
      </div>
      <div className="payout-settings__cell">
        <Field
          label="Payment fee"
          hint="%"
          value={draft.feeText}
          onChange={(feeText) => onChange({ ...draft, feeText })}
        />
        <p className="payout-settings__hint">Card, courier and so on. One flat rate.</p>
      </div>
      <div className="payout-settings__cell">
        <Field
          label="Drybrush pay"
          hint="%"
          value={draft.drybrushText}
          onChange={(drybrushText) => onChange({ ...draft, drybrushText })}
        />
        <Field
          label="Drybrush minimum"
          hint="lei per piece"
          value={draft.drybrushMinText}
          onChange={(drybrushMinText) => onChange({ ...draft, drybrushMinText })}
        />
        <p className="payout-settings__hint">Of the price paid, never less than the minimum.</p>
      </div>
      <div className="payout-settings__cell">
        <Field
          label="First month"
          hint="yyyy-mm"
          value={draft.firstMonth}
          onChange={(firstMonth) => onChange({ ...draft, firstMonth })}
        />
        <p className="payout-settings__hint">Earlier months are not loaded.</p>
      </div>
    </div>
  );
}
