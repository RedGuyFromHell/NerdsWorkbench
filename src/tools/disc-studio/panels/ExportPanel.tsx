// Export the print PNG (transparent where there is no ink) or a preview of the canvas.
import { patchSetting, type FileUi } from "../engine/actions";
import type { DiscDocument } from "../engine/document";
import { exportPng } from "../engine/fileActions";
import { Button } from "../../../ui/Button";
import { Field } from "../../../ui/Field";
import { SectionHeader } from "../../../ui/SectionHeader";
import { useDocumentVersion } from "../useDocumentVersion";

export function ExportPanel({ doc, ui }: { doc: DiscDocument; ui: FileUi }) {
  useDocumentVersion(doc);
  return (
    <section className="disc-panel">
      <SectionHeader title="Export" />
      <Field
        label="File name"
        value={doc.settings.name}
        onChange={(name) => patchSetting(doc, "name", name)}
      />
      <Button variant="primary" size="large" onClick={() => void exportPng(doc, ui, "print")}>
        Export print PNG
      </Button>
      <Button onClick={() => void exportPng(doc, ui, "preview")}>Export preview</Button>
      <p className="disc-hint">
        Print PNG: transparent where there is no ink, no guides, DPI saved in the file.
      </p>
    </section>
  );
}
