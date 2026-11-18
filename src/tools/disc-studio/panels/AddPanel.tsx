// What can be added to the design: images from a file dialog (or dropped on the window), and text.
import { addTextLayer, type FileUi } from "../engine/actions";
import type { DiscDocument } from "../engine/document";
import { addImagesFromDisk } from "../engine/fileActions";
import { Button } from "../../../ui/Button";
import { SectionHeader } from "../../../ui/SectionHeader";

export function AddPanel({ doc, ui }: { doc: DiscDocument; ui: FileUi }) {
  return (
    <section className="disc-panel">
      <SectionHeader title="Add" />
      <div className="disc-buttons">
        <Button onClick={() => void addImagesFromDisk(doc, ui)}>Add image</Button>
        <Button onClick={() => addTextLayer(doc)}>Add text</Button>
      </div>
      <p className="disc-hint">
        Or drop PNG, JPG or SVG files on the window to add them as layers.
      </p>
    </section>
  );
}
