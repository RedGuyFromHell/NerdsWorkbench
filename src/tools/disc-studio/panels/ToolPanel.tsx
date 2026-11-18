// The tool buttons (move, eraser, restore) and the brush. The eraser works on the selected layer.
import type { DiscDocument, Tool } from "../engine/document";
import { setBrush, setSoftness, setTool } from "../engine/toolActions";
import { MIN_BRUSH_MM } from "../engine/pointer";
import { Button } from "../../../ui/Button";
import { NumberField } from "../../../ui/NumberField";
import { SectionHeader } from "../../../ui/SectionHeader";
import { useDocumentVersion } from "../useDocumentVersion";

const TOOL_BUTTONS: readonly { tool: Tool; label: string; key: string }[] = [
  { tool: "move", label: "Move", key: "V" },
  { tool: "erase", label: "Eraser", key: "E" },
  { tool: "restore", label: "Restore", key: "R" },
];

export function ToolPanel({ doc }: { doc: DiscDocument }) {
  useDocumentVersion(doc);
  return (
    <section className="disc-panel">
      <SectionHeader title="Tool" />
      <div className="disc-buttons">
        {TOOL_BUTTONS.map(({ tool, label, key }) => (
          <Button
            key={tool}
            title={`${label} (${key})`}
            aria-pressed={doc.tool === tool}
            className={doc.tool === tool ? "disc-tool disc-tool--on" : "disc-tool"}
            onClick={() => setTool(doc, tool)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="disc-panel__pair">
        <NumberField
          label="Brush (mm)"
          value={doc.brushMm}
          step={0.5}
          min={MIN_BRUSH_MM}
          onChange={(brushMm) => setBrush(doc, brushMm)}
        />
        <NumberField
          label="Softness"
          value={doc.soft}
          step={0.1}
          min={0}
          max={1}
          onChange={(soft) => setSoftness(doc, soft)}
        />
      </div>
      <p className="disc-hint">
        Keys: V move · E eraser · R restore. The eraser works on the selected layer only. Wheel =
        brush size. Ctrl+Z = undo the last stroke.
      </p>
    </section>
  );
}
