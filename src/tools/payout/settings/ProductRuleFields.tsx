import { Field } from "../../../ui/Field";
import { TextArea } from "../../../ui/TextArea";
import type { SettingsDraft } from "./settingsForm";

interface ProductRuleFieldsProps {
  draft: SettingsDraft;
  onChange(draft: SettingsDraft): void;
}

/** Which order lines count: tags of the product, and products named by title. */
export function ProductRuleFields({ draft, onChange }: ProductRuleFieldsProps) {
  return (
    <>
      <Field
        label="Tag is any of"
        hint="separate with commas"
        value={draft.includeTagsText}
        onChange={(includeTagsText) => onChange({ ...draft, includeTagsText })}
      />
      <Field
        label="But none of"
        hint="separate with commas"
        value={draft.excludeTagsText}
        onChange={(excludeTagsText) => onChange({ ...draft, excludeTagsText })}
      />
      <TextArea
        label="Also these products"
        hint="one title per line, counted whatever their tags"
        rows={3}
        value={draft.extraProductsText}
        onChange={(extraProductsText) => onChange({ ...draft, extraProductsText })}
      />
    </>
  );
}
