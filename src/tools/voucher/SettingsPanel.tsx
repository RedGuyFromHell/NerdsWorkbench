// The right-hand column: 01 Visual, 02 Discount, 03 Code, and the GENERATE! button with the reason
// it is disabled. It only shows and edits the settings; the screen owns them.
import { Button } from "../../ui/Button";
import { Checkbox } from "../../ui/Checkbox";
import { ColorField } from "../../ui/ColorField";
import { Field } from "../../ui/Field";
import { NumberField } from "../../ui/NumberField";
import { SectionHeader } from "../../ui/SectionHeader";
import { Select } from "../../ui/Select";
import type { GenerateCheck } from "./core/generateGuard";
import {
  FONT_SIZE_RANGE,
  LETTER_SPACING_RANGE,
  OUTLINE_RANGE,
  RANDOM_LENGTH_RANGE,
  VOUCHER_COUNT_RANGE,
  normalisePrefix,
  type VoucherSettings,
} from "./core/voucherSettings";
import { DiscountSection, type ShopifyConnection } from "./DiscountSection";
import { PathField } from "./PathField";
import type { CollectionsState } from "./useCollections";

interface SettingsPanelProps {
  settings: VoucherSettings;
  onChange(patch: Partial<VoucherSettings>): void;
  templatePath: string;
  onChooseTemplate(): void;
  onChooseFolder(): void;
  fontFamilies: readonly string[];
  connection: ShopifyConnection;
  collections: CollectionsState;
  onOpenSettings(): void;
  generate: GenerateCheck;
}

interface SectionProps {
  settings: VoucherSettings;
  onChange(patch: Partial<VoucherSettings>): void;
}

function VisualSection({
  settings,
  onChange,
  templatePath,
  onChooseTemplate,
  fontFamilies,
}: SectionProps & Pick<SettingsPanelProps, "templatePath" | "onChooseTemplate" | "fontFamilies">) {
  const fontOptions = fontFamilies.map((family) => ({ value: family, label: family }));
  return (
    <section className="voucher-section">
      <SectionHeader number={1} title="Visual Settings" />
      <PathField
        label="Choose Voucher"
        hint="jpg · png · webp"
        value={templatePath}
        placeholder="No file selected..."
        onBrowse={onChooseTemplate}
      />
      <Select
        label="Code Font"
        value={settings.fontFamily}
        options={fontOptions}
        onChange={(fontFamily) => onChange({ fontFamily })}
      />
      <div className="voucher-triple">
        <NumberField
          label="Font Size"
          hint="px"
          value={settings.fontSizePx}
          onChange={(fontSizePx) => onChange({ fontSizePx })}
          {...FONT_SIZE_RANGE}
        />
        <NumberField
          label="Letter Spacing"
          hint="px"
          value={settings.letterSpacingPx}
          onChange={(letterSpacingPx) => onChange({ letterSpacingPx })}
          {...LETTER_SPACING_RANGE}
        />
        <NumberField
          label="Outline"
          hint="px"
          value={settings.outlineThicknessPx}
          onChange={(outlineThicknessPx) => onChange({ outlineThicknessPx })}
          {...OUTLINE_RANGE}
        />
      </div>
      <div className="voucher-pair">
        <ColorField
          label="Code Color"
          value={settings.codeColour}
          onChange={(codeColour) => onChange({ codeColour })}
        />
        <ColorField
          label="Outline Color"
          value={settings.outlineColour}
          onChange={(outlineColour) => onChange({ outlineColour })}
        />
      </div>
    </section>
  );
}

function CodeSection({
  settings,
  onChange,
  onChooseFolder,
}: SectionProps & Pick<SettingsPanelProps, "onChooseFolder">) {
  return (
    <section className="voucher-section">
      <SectionHeader number={3} title="Code Settings" />
      <div className="voucher-pair">
        <Field
          label="Discount Code Prefix"
          mono
          value={settings.prefix}
          onChange={(text) => onChange({ prefix: normalisePrefix(text) })}
        />
        <NumberField
          label="No. of Vouchers"
          step={10}
          value={settings.voucherCount}
          onChange={(voucherCount) => onChange({ voucherCount })}
          {...VOUCHER_COUNT_RANGE}
        />
      </div>
      <div className="voucher-pair">
        <NumberField
          label="Random Characters"
          hint="count"
          value={settings.randomLength}
          onChange={(randomLength) => onChange({ randomLength })}
          {...RANDOM_LENGTH_RANGE}
        />
        <Checkbox
          label="Numbers only"
          checked={settings.numbersOnly}
          onChange={(numbersOnly) => onChange({ numbersOnly })}
        />
      </div>
      <PathField
        label="Save Path"
        value={settings.savePath}
        placeholder="C:\Users\...\Vouchers\"
        onChange={(savePath) => onChange({ savePath })}
        onBrowse={onChooseFolder}
      />
    </section>
  );
}

function GenerateBox({ generate, settings }: Pick<SettingsPanelProps, "generate" | "settings">) {
  const count = settings.voucherCount;
  const hint = generate.canGenerate
    ? `→ will create ${count.toLocaleString("en-US")} voucher${count === 1 ? "" : "s"} at ${settings.savePath}`
    : `✦ ${generate.reason}`;
  // WHY: no onClick yet. Generating (the codes, the discount, the images) is the next slice.
  return (
    <div className="voucher-generate">
      <Button variant="primary" size="large" disabled={!generate.canGenerate}>
        GENERATE!
      </Button>
      <p className="voucher-hint" role="status">
        {hint}
      </p>
    </div>
  );
}

export function SettingsPanel({
  settings,
  onChange,
  templatePath,
  onChooseTemplate,
  onChooseFolder,
  fontFamilies,
  connection,
  collections,
  onOpenSettings,
  generate,
}: SettingsPanelProps) {
  return (
    <aside className="voucher-settings">
      <VisualSection
        settings={settings}
        onChange={onChange}
        templatePath={templatePath}
        onChooseTemplate={onChooseTemplate}
        fontFamilies={fontFamilies}
      />
      <DiscountSection
        settings={settings}
        onChange={onChange}
        connection={connection}
        collections={collections}
        onOpenSettings={onOpenSettings}
      />
      <CodeSection settings={settings} onChange={onChange} onChooseFolder={onChooseFolder} />
      <GenerateBox generate={generate} settings={settings} />
    </aside>
  );
}
