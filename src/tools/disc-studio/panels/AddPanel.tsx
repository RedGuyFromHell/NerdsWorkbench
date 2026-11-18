// What can be added to the design: text from a button, images by dropping files.
import { addTextLayer } from "../engine/actions";
import type { DiscDocument } from "../engine/document";
import { Button } from "../../../ui/Button";
import { SectionHeader } from "../../../ui/SectionHeader";

export function AddPanel({ doc }: { doc: DiscDocument }) {
  return (
    <section className="disc-panel">
      <SectionHeader title="Add" />
      <div className="disc-buttons">
        <Button onClick={() => addTextLayer(doc)}>Add text</Button>
      </div>
      <p className="disc-hint">Drop PNG, JPG or SVG files on the window to add them as layers.</p>
    </section>
  );
}
