// The left column: the disc and mask measurements and the view options.
import { patchSetting, type FileUi } from "../engine/actions";
import type { DiscDocument } from "../engine/document";
import { uploadMaskFromDisk } from "../engine/fileActions";
import type { DiscSettings } from "../engine/project";
import { Button } from "../../../ui/Button";
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

const BUILTIN_OPTION = { value: "builtin", label: "Built-in" };
const UPLOADED_OPTION = { value: "upload", label: "Uploaded" };
const NO_MASK_OPTION = { value: "none", label: "None (whole disc)" };

function maskModeOf(value: string): DiscSettings["maskMode"] {
  return value === "none" || value === "upload" ? value : "builtin";
}

export function DiscSettingsPanel({ doc, ui }: { doc: DiscDocument; ui: FileUi }) {
  useDocumentVersion(doc);
  const { settings } = doc;
  // WHY: Uploaded is offered once a mask file exists; until then there is nothing to select.
  const maskOptions = doc.mask
    ? [BUILTIN_OPTION, UPLOADED_OPTION, NO_MASK_OPTION]
    : [BUILTIN_OPTION, NO_MASK_OPTION];
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
          options={maskOptions}
          onChange={(value) => patchSetting(doc, "maskMode", maskModeOf(value))}
        />
        {settings.maskMode === "builtin" ? (
          <div className="disc-panel__pair">
            {numberField("Margin", "margin", { step: 0.5, min: 0 })}
            {numberField("Band", "band", { step: 0.5, min: 0 })}
            {numberField("Band curve", "curve", { step: 0.5, min: 0 })}
          </div>
        ) : null}
        <Button onClick={() => void uploadMaskFromDisk(doc, ui)}>Upload mask…</Button>
        <p className="disc-hint">
          Mask file: transparent = no ink, or white = art and dark/grey = no ink. It is stretched to
          the full square.
        </p>
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
