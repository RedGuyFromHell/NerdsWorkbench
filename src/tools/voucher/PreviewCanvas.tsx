// The template with the code drawn on it, and the code area drawn over it: draw it with the pointer,
// drag it to move it, drag a corner to resize it. The canvas is the template's own size and CSS
// scales it to fit, so the pointer maths and the drawing share one coordinate system (the
// template's pixels), and what is drawn here is what `drawVoucher` will write to a file.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { drawVoucher, loadVoucherFont, type CodeStyle } from "./core/drawVoucher";
import { CORNERS, toImagePixels, type Rect } from "./core/selection";
import { templateBounds, type VoucherTemplate } from "./template";
import { useSelectionDrag } from "./useSelectionDrag";

interface PreviewCanvasProps {
  template: VoucherTemplate | null;
  /** The code area in the template's pixels, as it is dragged: not rounded. */
  selection: Rect | null;
  onSelectionChange(selection: Rect | null): void;
  style: CodeStyle;
  sample: string;
}

export function PreviewCanvas({
  template,
  selection,
  onSelectionChange,
  style,
  sample,
}: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [readyFamily, setReadyFamily] = useState<string | null>(null);
  const dragHandlers = useSelectionDrag({ canvasRef, template, selection, onSelectionChange });

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
    const bounds = templateBounds(template);
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
      <div className="voucher-preview__overlay" {...dragHandlers}>
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
