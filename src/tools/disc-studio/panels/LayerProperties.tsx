// The properties of the selected layer: its own (text or image) and the ones every layer has.
import {
  centreSelected,
  duplicateSelected,
  fitSelectedImage,
  patchLayer,
  patchTextLayer,
} from "../engine/actions";
import { TEXT_FONTS } from "../engine/addLayer";
import { DEFAULT_TINT_COLOUR } from "../engine/colours";
import type { DiscDocument } from "../engine/document";
import { roundToHundredths } from "../engine/geometry";
import type { ImageLayer, Layer, TextLayer } from "../engine/project";
import { clearEraser } from "../engine/toolActions";
import { Button } from "../../../ui/Button";
import { Checkbox } from "../../../ui/Checkbox";
import { ColorField } from "../../../ui/ColorField";
import { NumberField } from "../../../ui/NumberField";
import { SectionHeader } from "../../../ui/SectionHeader";
import { Select } from "../../../ui/Select";
import { TextArea } from "../../../ui/TextArea";
import { useDocumentVersion } from "../useDocumentVersion";

const FONT_OPTIONS = TEXT_FONTS.map((font) => ({ value: font, label: font }));

const CLIP_OPTIONS = [
  { value: "mask", label: "Mask" },
  { value: "disc", label: "Whole disc" },
  { value: "none", label: "Nothing" },
] as const;

function clipOf(value: string): Layer["clip"] {
  return value === "disc" || value === "none" ? value : "mask";
}

function TextProperties({ doc, layer }: { doc: DiscDocument; layer: TextLayer }) {
  const patch = (changes: Partial<TextLayer>) => patchTextLayer(doc, layer, changes);
  return (
    <>
      <TextArea label="Text" rows={2} value={layer.text} onChange={(text) => patch({ text })} />
      <Select
        label="Font"
        value={layer.font}
        options={FONT_OPTIONS}
        onChange={(font) => patch({ font })}
      />
      <div className="disc-panel__pair">
        <NumberField
          label="Size (mm)"
          value={roundToHundredths(layer.size)}
          step={0.1}
          min={0}
          onChange={(size) => patch({ size })}
        />
        <NumberField
          label="Spacing (mm)"
          value={roundToHundredths(layer.spacing)}
          step={0.05}
          onChange={(spacing) => patch({ spacing })}
        />
      </div>
      <ColorField label="Colour" value={layer.color} onChange={(color) => patch({ color })} />
      <NumberField
        label="Outline (mm)"
        value={roundToHundredths(layer.strokeW)}
        step={0.05}
        min={0}
        onChange={(strokeW) => patch({ strokeW })}
      />
      <ColorField
        label="Outline colour"
        value={layer.stroke}
        onChange={(stroke) => patch({ stroke })}
      />
      <div className="disc-panel__pair">
        <Checkbox label="Bold" checked={layer.bold} onChange={(bold) => patch({ bold })} />
        <Checkbox label="Italic" checked={layer.italic} onChange={(italic) => patch({ italic })} />
      </div>
    </>
  );
}

function ImageProperties({ doc, layer }: { doc: DiscDocument; layer: ImageLayer }) {
  const patch = (changes: Partial<ImageLayer>) => patchLayer(doc, layer, changes);
  return (
    <>
      <NumberField
        label="Width (mm)"
        value={roundToHundredths(layer.w)}
        step={0.5}
        min={0}
        onChange={(w) => patch({ w })}
      />
      <div className="disc-buttons">
        <Button onClick={() => fitSelectedImage(doc, "cover")}>Cover disc</Button>
        <Button onClick={() => fitSelectedImage(doc, "fit")}>Fit in disc</Button>
      </div>
      <Checkbox
        label="Recolour (one colour, for logos)"
        checked={layer.tint ?? false}
        onChange={(tint) => patch({ tint, tintColor: layer.tintColor ?? DEFAULT_TINT_COLOUR })}
      />
      <ColorField
        label="Colour"
        value={layer.tintColor ?? DEFAULT_TINT_COLOUR}
        onChange={(tintColor) => patch({ tintColor })}
      />
    </>
  );
}

function CommonProperties({ doc, layer }: { doc: DiscDocument; layer: Layer }) {
  const patch = (changes: Partial<Layer>) => patchLayer(doc, layer, changes);
  return (
    <>
      <NumberField
        label="X from centre (mm)"
        value={roundToHundredths(layer.x)}
        step={0.1}
        onChange={(x) => patch({ x })}
      />
      <NumberField
        label="Y from centre (mm)"
        value={roundToHundredths(layer.y)}
        step={0.1}
        onChange={(y) => patch({ y })}
      />
      <div className="disc-panel__pair">
        <NumberField
          label="Rotation (°)"
          value={roundToHundredths(layer.rot)}
          step={0.5}
          onChange={(rot) => patch({ rot })}
        />
        <NumberField
          label="Opacity"
          value={roundToHundredths(layer.opacity)}
          step={0.05}
          min={0}
          max={1}
          onChange={(opacity) => patch({ opacity })}
        />
      </div>
      <Select
        label="Clip to"
        value={layer.clip}
        options={CLIP_OPTIONS}
        onChange={(value) => patch({ clip: clipOf(value) })}
      />
      <Checkbox label="Mirror" checked={layer.flip} onChange={(flip) => patch({ flip })} />
      <div className="disc-buttons">
        <Button onClick={() => centreSelected(doc)}>Centre</Button>
        <Button onClick={() => duplicateSelected(doc)}>Copy</Button>
      </div>
      {layer.erase?.length ? (
        <Button onClick={() => clearEraser(doc)}>
          Clear eraser ({layer.erase.length} strokes)
        </Button>
      ) : null}
    </>
  );
}

export function LayerProperties({ doc }: { doc: DiscDocument }) {
  useDocumentVersion(doc);
  const layer = doc.selected;
  if (!layer) return null;

  return (
    <section key={layer.id} className="disc-panel">
      <SectionHeader title={layer.type === "image" ? "Image" : "Text"} />
      {layer.type === "image" ? (
        <ImageProperties doc={doc} layer={layer} />
      ) : (
        <TextProperties doc={doc} layer={layer} />
      )}
      <CommonProperties doc={doc} layer={layer} />
    </section>
  );
}
