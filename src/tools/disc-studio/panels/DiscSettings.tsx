// The left column: the disc and mask measurements and the view options.
import { patchSetting } from "../engine/actions";
import type { DiscDocument } from "../engine/document";
import type { DiscSettings } from "../engine/project";
import { Checkbox } from "../../../ui/Checkbox";
import { ColorField } from "../../../ui/ColorField";
import { NumberField } from "../../../ui/NumberField";
import { SectionHeader } from "../../../ui/SectionHeader";
import { Select } from "../../../ui/Select";
import { useDocumentVersion } from "../useDocumentVersion";

// WHY: a diameter or a resolution of 0 would give a canvas with no pixels; 1200 dpi is past any printer here.
const MIN_DISC_MM = 1;
const MIN_DPI = 1;
const MAX_DPI = 1200;

const MASK_OPTIONS = [
  { value: "builtin", label: "Built-in" },
  { value: "none", label: "None (whole disc)" },
] as const;

function maskModeOf(value: string): DiscSettings["maskMode"] {
  return value === "none" ? "none" : "builtin";
}

export function DiscSettingsPanel({ doc }: { doc: DiscDocument }) {
  useDocumentVersion(doc);
  const { settings } = doc;
  const numberField = (
    label: string,
    key: "d" | "hole" | "bleed" | "dpi" | "margin" | "band" | "curve",
    options: { step: number; min: number; max?: number },
  ) => (
    <NumberField
      label={label}
      value={settings[key]}
      onChange={(value) => patchSetting(doc, key, value)}
      {...options}
    />
  );

  return (
    <>
      <section className="disc-panel">
        <SectionHeader title="Disc (mm)" />
        <div className="disc-panel__pair">
          {numberField("Diameter", "d", { step: 0.5, min: MIN_DISC_MM })}
          {numberField("Hole", "hole", { step: 0.5, min: 0 })}
          {numberField("Bleed", "bleed", { step: 0.5, min: 0 })}
          {numberField("DPI", "dpi", { step: 10, min: MIN_DPI, max: MAX_DPI })}
        </div>
      </section>

      <section className="disc-panel">
        <SectionHeader title="Mask" />
        <Select
          label="Type"
          value={settings.maskMode}
          options={MASK_OPTIONS}
          onChange={(value) => patchSetting(doc, "maskMode", maskModeOf(value))}
        />
        {settings.maskMode === "builtin" ? (
          <div className="disc-panel__pair">
            {numberField("Margin", "margin", { step: 0.5, min: 0 })}
            {numberField("Band", "band", { step: 0.5, min: 0 })}
            {numberField("Band curve", "curve", { step: 0.5, min: 0 })}
          </div>
        ) : null}
      </section>

      <section className="disc-panel">
        <SectionHeader title="View" />
        <Checkbox
          label="Guides (cut + safe lines)"
          checked={settings.guides}
          onChange={(checked) => patchSetting(doc, "guides", checked)}
        />
        <Checkbox
          label="Tint the no-ink zones"
          checked={settings.zones}
          onChange={(checked) => patchSetting(doc, "zones", checked)}
        />
        <ColorField
          label="PLA colour"
          value={settings.pla}
          onChange={(value) => patchSetting(doc, "pla", value)}
        />
        <ColorField
          label="Background"
          value={settings.bg}
          onChange={(value) => patchSetting(doc, "bg", value)}
        />
      </section>
    </>
  );
}
