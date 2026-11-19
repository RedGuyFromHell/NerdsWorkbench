// The template with the code drawn on it, and the code area drawn over it: draw it with the pointer,
// drag it to move it, drag a corner to resize it. The canvas is the template's own size and CSS
// scales it to fit, so the pointer maths and the drawing share one coordinate system (the
// template's pixels), and what is drawn here is what `drawVoucher` will write to a file.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { drawVoucher, loadVoucherFont, type CodeStyle } from "./core/drawVoucher";
import { toImagePixels, type Corner, type Point, type Rect } from "./core/selection";
import { dragSelection, finishDrag, type Drag } from "./core/selectionDrag";
import type { VoucherTemplate } from "./template";

const CORNERS: readonly Corner[] = ["nw", "ne", "sw", "se"];

interface PreviewCanvasProps {
  template: VoucherTemplate | null;
  /** The code area in the template's pixels, as it is dragged: not rounded. */
  selection: Rect | null;
  onSelectionChange(selection: Rect | null): void;
  style: CodeStyle;
  sample: string;
}

function asCorner(target: EventTarget): Corner | null {
  const corner = target instanceof HTMLElement ? target.dataset.corner : undefined;
  return CORNERS.find((candidate) => candidate === corner) ?? null;
}

function boundsOf(template: VoucherTemplate): Rect {
  return { x: 0, y: 0, width: template.width, height: template.height };
}

function contains(area: Rect, point: Point): boolean {
  return (
    point.x >= area.x &&
    point.x <= area.x + area.width &&
    point.y >= area.y &&
    point.y <= area.y + area.height
  );
}

export function PreviewCanvas({
  template,
  selection,
  onSelectionChange,
  style,
  sample,
}: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ drag: Drag; latest: Rect | null } | null>(null);
  const [readyFamily, setReadyFamily] = useState<string | null>(null);

  // WHY: a family the browser has not loaded draws in a fallback face without an error, so the
  // code is drawn only once the family reports ready.
  useEffect(() => {
    let current = true;
    void loadVoucherFont(style.fontFamily)
      .catch((error: unknown) => {
        console.warn("The code font could not be loaded; the preview may use another face.", error);
      })
      .then(() => {
        if (current) setReadyFamily(style.fontFamily);
      });
    return () => {
      current = false;
    };
  }, [style.fontFamily]);

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context || template === null) return;
    const bounds = boundsOf(template);
    const fontReady = readyFamily === style.fontFamily;
    drawVoucher(context, {
      template: template.image,
      templateWidth: template.width,
      templateHeight: template.height,
      code: fontReady ? sample : null,
      style,
      // WHY: the same whole-pixel area the export will use, not the dragged fraction.
      area: selection === null ? null : toImagePixels(selection, bounds, template),
    });
  }, [template, selection, style, sample, readyFamily]);

  if (template === null) {
    return (
      <p className="voucher-preview__empty">
        Choose a voucher image, or drop one here (jpg, png or webp).
      </p>
    );
  }

  const bounds = boundsOf(template);

  // The pointer in the template's pixels, whatever size CSS shows the canvas at.
  function toTemplatePoint(event: PointerEvent): Point | null {
    const box = canvasRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0 || template === null) return null;
    return {
      x: ((event.clientX - box.left) * template.width) / box.width,
      y: ((event.clientY - box.top) * template.height) / box.height,
    };
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const point = toTemplatePoint(event);
    if (!point) return;
    const corner = asCorner(event.target);
    let drag: Drag;
    if (selection && corner) drag = { kind: "resize", corner, original: selection };
    else if (selection && contains(selection, point)) {
      drag = { kind: "move", start: point, original: selection };
    } else {
      drag = { kind: "draw", start: point };
      onSelectionChange(null);
    }
    // A new rectangle starts empty: a click that never moves must not bring the old one back.
    dragRef.current = { drag, latest: drag.kind === "draw" ? null : selection };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function continueDrag(event: PointerEvent) {
    const active = dragRef.current;
    const point = toTemplatePoint(event);
    if (!active || !point) return;
    active.latest = dragSelection(active.drag, point, bounds);
    onSelectionChange(active.latest);
  }

  // WHY: also runs when the browser takes the pointer away (a lost capture), so a drag never hangs on.
  function endDrag() {
    const active = dragRef.current;
    dragRef.current = null;
    if (active?.latest) onSelectionChange(finishDrag(active.drag, active.latest));
  }

  return (
    <div
      className="voucher-preview__frame"
      style={{ "--ratio": template.width / template.height } as CSSProperties}
    >
      <canvas
        ref={canvasRef}
        className="voucher-preview__canvas"
        width={template.width}
        height={template.height}
      />
      <div
        className="voucher-preview__overlay"
        onPointerDown={startDrag}
        onPointerMove={continueDrag}
        onPointerUp={endDrag}
        onLostPointerCapture={endDrag}
      >
        {selection ? (
          <div
            className="voucher-selection"
            style={{
              left: `${(selection.x / template.width) * 100}%`,
              top: `${(selection.y / template.height) * 100}%`,
              width: `${(selection.width / template.width) * 100}%`,
              height: `${(selection.height / template.height) * 100}%`,
            }}
          >
            {CORNERS.map((corner) => (
              <span
                key={corner}
                className={`voucher-selection__handle voucher-selection__handle--${corner}`}
                data-corner={corner}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
