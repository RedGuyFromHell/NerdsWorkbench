// The Disc Studio screen: settings on the left, the disc canvas in the middle, layers and
// properties on the right. The canvas is drawn by the DiscDocument on requestAnimationFrame;
// React only renders the panels, which follow the document through useDocumentVersion.
import { useEffect, useRef, useState, type DragEvent } from "react";
import type { ToolContext } from "../types";
import "../../styles/disc-fonts.css";
import "./disc-studio.css";
import { addImageFiles } from "./engine/actions";
import { DiscDocument } from "./engine/document";
import { attachPointer } from "./engine/pointer";
import { AddPanel } from "./panels/AddPanel";
import { DiscSettingsPanel } from "./panels/DiscSettings";
import { LayerList } from "./panels/LayerList";
import { LayerProperties } from "./panels/LayerProperties";
import { SectionHeader } from "../../ui/SectionHeader";
import { useDocumentVersion } from "./useDocumentVersion";

function carriesFiles(event: DragEvent): boolean {
  return event.dataTransfer.types.includes("Files");
}

function EmptyHint({ doc }: { doc: DiscDocument }) {
  useDocumentVersion(doc);
  if (doc.layers.length > 0) return null;
  return <p className="disc-studio__empty">Drop images here, or use “Add text”.</p>;
}

export default function DiscStudio({ setStatus }: ToolContext) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<DiscDocument | null>(null);
  const [dropping, setDropping] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const created = new DiscDocument(canvas);
    const detachPointer = attachPointer(canvas, created);
    let mounted = true;
    created.requestDraw();
    // WHY: text drawn before its font has loaded uses a fallback; draw again once the fonts are ready.
    void document.fonts.ready.then(() => {
      if (mounted) created.requestDraw();
    });
    setDoc(created);
    return () => {
      mounted = false;
      detachPointer();
      setDoc(null);
    };
  }, []);

  function onDragOver(event: DragEvent) {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    setDropping(true);
  }

  function onDragLeave(event: DragEvent) {
    const into = event.relatedTarget;
    if (into instanceof Node && event.currentTarget.contains(into)) return;
    setDropping(false);
  }

  function onDrop(event: DragEvent) {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    setDropping(false);
    if (doc) void addImageFiles(doc, Array.from(event.dataTransfer.files), setStatus);
  }

  return (
    <div
      className={dropping ? "disc-studio disc-studio--dropping" : "disc-studio"}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <aside className="disc-studio__side disc-studio__side--left">
        {doc ? <DiscSettingsPanel doc={doc} /> : null}
      </aside>
      <main className="disc-studio__stage">
        <canvas ref={canvasRef} className="disc-studio__canvas" />
        {doc ? <EmptyHint doc={doc} /> : null}
      </main>
      <aside className="disc-studio__side disc-studio__side--right">
        {doc ? (
          <>
            <AddPanel doc={doc} />
            <LayerList doc={doc} />
            <LayerProperties doc={doc} />
            <section className="disc-panel">
              <SectionHeader title="Mouse" />
              <p className="disc-hint">
                Drag = move · wheel = size · Shift + wheel = rotate · Alt = finer steps
              </p>
            </section>
          </>
        ) : null}
      </aside>
    </div>
  );
}
