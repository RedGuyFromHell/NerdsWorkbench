// Settings › Payout: people, rates, the product rule and the fallback cost table. Every change is
// saved on the PC as soon as it has no problem; a problem is listed under the section instead.
import type { ReactNode } from "react";
import "../payout.css";
import { CostTable } from "./CostTable";
import { PeopleTable } from "./PeopleTable";
import { ProductRuleFields } from "./ProductRuleFields";
import { RatesFields } from "./RatesFields";
import { usePayoutSettings } from "./usePayoutSettings";

interface PartProps {
  title: string;
  children: ReactNode;
}

function Part({ title, children }: PartProps) {
  return (
    <div className="payout-settings__part">
      <h3 className="payout-settings__heading">{title}</h3>
      {children}
    </div>
  );
}

export function PayoutSettingsSection() {
  const { state, changeDraft, changePeople } = usePayoutSettings();

  if (state.kind === "loading") return <p role="status">Loading...</p>;
  if (state.kind === "failed") {
    return (
      <p role="alert" className="payout-settings__problem">
        The payout settings could not be read, so they are not shown (the file is left as it is):{" "}
        {state.message}
      </p>
    );
  }

  const { draft, people, issues, saveError } = state;
  return (
    <div className="payout-settings">
      <Part title="People">
        <PeopleTable people={people} onChange={changePeople} />
      </Part>
      <Part title="Rates and first month">
        <RatesFields draft={draft} onChange={changeDraft} />
      </Part>
      <Part title="Which products count">
        <ProductRuleFields draft={draft} onChange={changeDraft} />
      </Part>
      <Part title="Cost table (when Shopify has no cost)">
        <CostTable
          rows={draft.costRows}
          onChange={(costRows) => changeDraft({ ...draft, costRows })}
        />
      </Part>
      <div role="status">
        {issues.length > 0 ? (
          <>
            <p className="payout-settings__problem">Not saved yet. Fix this first:</p>
            <ul className="payout-settings__issues">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="payout-settings__hint">Saved on this PC.</p>
        )}
      </div>
      {saveError === "" ? null : (
        <p role="alert" className="payout-settings__problem">
          Could not save: {saveError}
        </p>
      )}
    </div>
  );
}
