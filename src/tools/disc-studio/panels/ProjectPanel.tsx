// Save and open a project file (.nerd; old .disc.json files open too).
import type { FileUi } from "../engine/actions";
import type { DiscDocument } from "../engine/document";
import { saveProjectToDisk } from "../engine/fileActions";
import { Button } from "../../../ui/Button";
import { SectionHeader } from "../../../ui/SectionHeader";

interface ProjectPanelProps {
  doc: DiscDocument;
  ui: FileUi;
  /** Opens a project; the screen asks about unsaved work first. */
  onOpenProject(): void;
}

export function ProjectPanel({ doc, ui, onOpenProject }: ProjectPanelProps) {
  return (
    <section className="disc-panel">
      <SectionHeader title="Project" />
      <div className="disc-buttons">
        <Button onClick={() => void saveProjectToDisk(doc, ui)}>Save project</Button>
        <Button onClick={onOpenProject}>Open project</Button>
      </div>
      <p className="disc-hint">
        A project file keeps every image, so you can open it again and get the same result.
      </p>
    </section>
  );
}
