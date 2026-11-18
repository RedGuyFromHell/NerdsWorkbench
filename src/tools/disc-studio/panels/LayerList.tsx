// The layers, top first: show or hide, select, move up or down, delete.
import { deleteLayer, patchLayer, reorderLayer, selectLayer } from "../engine/actions";
import type { DiscDocument } from "../engine/document";
import { Button } from "../../../ui/Button";
import { Checkbox } from "../../../ui/Checkbox";
import { SectionHeader } from "../../../ui/SectionHeader";
import { useDocumentVersion } from "../useDocumentVersion";

export function LayerList({ doc }: { doc: DiscDocument }) {
  useDocumentVersion(doc);
  const topFirst = [...doc.layers].reverse();

  return (
    <section className="disc-panel">
      <SectionHeader title="Layers (top first)" />
      <ul className="layer-list">
        {topFirst.length === 0 ? <li className="layer-list__empty">No layers yet.</li> : null}
        {topFirst.map((layer) => (
          <li
            key={layer.id}
            className={layer === doc.selected ? "layer-row layer-row--selected" : "layer-row"}
          >
            <Checkbox
              boxOnly
              label={`Show ${layer.name}`}
              checked={layer.visible}
              onChange={(visible) => patchLayer(doc, layer, { visible })}
            />
            <button
              type="button"
              className="layer-row__name"
              onClick={() => selectLayer(doc, layer)}
            >
              {layer.name}
            </button>
            <Button title="Up" aria-label="Move up" onClick={() => reorderLayer(doc, layer.id, 1)}>
              ↑
            </Button>
            <Button
              title="Down"
              aria-label="Move down"
              onClick={() => reorderLayer(doc, layer.id, -1)}
            >
              ↓
            </Button>
            <Button
              title="Delete"
              aria-label="Delete layer"
              variant="danger"
              onClick={() => deleteLayer(doc, layer.id)}
            >
              ✕
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
