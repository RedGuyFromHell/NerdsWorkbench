// The Disc Studio screen: settings on the left, the disc canvas in the middle, layers and
// properties on the right. The canvas is drawn by the DiscDocument on requestAnimationFrame;
// React only renders the panels, which follow the document through useDocumentVersion.
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import type { ToolContext } from "../types";
import "../../styles/disc-fonts.css";
import "./disc-studio.css";
import { addImageFiles, type FileUi } from "./engine/actions";
import { DiscDocument } from "./engine/document";
import { openProjectFromPath, saveProjectToDisk } from "./engine/fileActions";
import { attachKeys, attachPointer } from "./engine/pointer";
import { AddPanel } from "./panels/AddPanel";
import { DiscSettingsPanel } from "./panels/DiscSettings";
import { LayerList } from "./panels/LayerList";
import { LayerProperties } from "./panels/LayerProperties";
import { ExportPanel } from "./panels/ExportPanel";
import { ProjectPanel } from "./panels/ProjectPanel";
import { ToolPanel } from "./panels/ToolPanel";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { SectionHeader } from "../../ui/SectionHeader";
import { useDocumentVersion } from "./useDocumentVersion";

function carriesFiles(event: DragEvent): boolean {
  return event.dataTransfer.types.includes("Files");
}

function EmptyHint({ doc }: { doc: DiscDocument }) {
  useDocumentVersion(doc);
  if (doc.layers.length > 0) return null;
  return <p className="disc-studio__empty">Drop images here, or use “Add image”.</p>;
}

export default function DiscStudio({ openRequest, setStatus, setUnsavedWork }: ToolContext) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<DiscDocument | null>(null);
  const [dropping, setDropping] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // WHY: stable, so panels and effects that take it do not run again on every render.
  const ui = useMemo<FileUi>(() => ({ status: setStatus, error: setErrorMessage }), [setStatus]);

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

  // WHY: the nonce of the last request handled, so a re-render does not open the file again, while
  // a new request for the same path (a new nonce) opens it again.
  const handledNonce = useRef<number | null>(null);
  useEffect(() => {
    if (!doc || !openRequest || handledNonce.current === openRequest.nonce) return;
    handledNonce.current = openRequest.nonce;
    void openProjectFromPath(doc, openRequest.path, ui);
  }, [doc, openRequest, ui]);

  // Tells the shell while the design differs from the last save or open (an undo back to it clears it).
  useEffect(() => {
    if (!doc) return;
    const work = { save: () => saveProjectToDisk(doc, ui) };
    let reported = false;
    const follow = () => {
      const dirty = doc.isDirty();
      if (dirty === reported) return;
      reported = dirty;
      setUnsavedWork(dirty ? work : null);
    };
    const unsubscribe = doc.subscribe(follow);
    return () => {
      unsubscribe();
      setUnsavedWork(null);
    };
  }, [doc, ui, setUnsavedWork]);

  useEffect(() => {
    if (!doc) return;
    // WHY: an opened tool stays mounted while hidden (App.tsx), and its keys must not act then.
    return attachKeys(doc, () => rootRef.current?.closest("[hidden]") === null);
  }, [doc]);

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
    if (doc) void addImageFiles(doc, Array.from(event.dataTransfer.files), ui);
  }

  return (
    <div
      ref={rootRef}
      className={dropping ? "disc-studio disc-studio--dropping" : "disc-studio"}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <aside className="disc-studio__side disc-studio__side--left">
        {doc ? (
          <>
            <DiscSettingsPanel doc={doc} ui={ui} />
            <ProjectPanel doc={doc} ui={ui} />
          </>
        ) : null}
      </aside>
      <main className="disc-studio__stage">
        <canvas ref={canvasRef} className="disc-studio__canvas" />
        {doc ? <EmptyHint doc={doc} /> : null}
      </main>
      <aside className="disc-studio__side disc-studio__side--right">
        {doc ? (
          <>
            <AddPanel doc={doc} ui={ui} />
            <ToolPanel doc={doc} />
            <LayerList doc={doc} />
            <LayerProperties doc={doc} />
            <ExportPanel doc={doc} ui={ui} />
            <section className="disc-panel">
              <SectionHeader title="Mouse and keys" />
              <p className="disc-hint">
                Drag = move · wheel = size · Shift + wheel = rotate · Alt = finer steps · arrows =
                nudge 0.1 mm (Shift: 1 mm) · Del = delete · Ctrl+D = copy · Ctrl+Z = undo ·
                Ctrl+Shift+Z = redo
              </p>
            </section>
          </>
        ) : null}
      </aside>
      {errorMessage ? (
        <Dialog
          title="Disc Studio"
          onClose={() => setErrorMessage(null)}
          actions={<Button onClick={() => setErrorMessage(null)}>OK</Button>}
        >
          <p>{errorMessage}</p>
        </Dialog>
      ) : null}
    </div>
  );
}
