// Turns one code into the bytes of its voucher image. One canvas is made per run and drawn over
// for every code, so a run of thousands of vouchers holds one image in memory, not thousands.
import { drawVoucher, loadVoucherFont, type CodeStyle } from "./core/drawVoucher";
import type { OutputFile } from "./core/outputFile";
import type { Rect } from "./core/selection";
import type { VoucherTemplate } from "./template";

export type ImageRenderer = (code: string) => Promise<Uint8Array>;

export interface VoucherLook {
  template: VoucherTemplate;
  /** The code area in the template's whole pixels. */
  area: Rect;
  style: CodeStyle;
}

const CANNOT_DRAW = "The voucher image cannot be drawn.";

function encodeCanvas(canvas: HTMLCanvasElement, output: OutputFile): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error(CANNOT_DRAW));
      },
      output.mimeType,
      output.quality,
    );
  });
}

/** Waits for the font, then returns the renderer. The template must stay open until the run ends. */
export async function makeImageRenderer(
  { template, area, style }: VoucherLook,
  output: OutputFile,
): Promise<ImageRenderer> {
  await loadVoucherFont(style.fontFamily);
  const canvas = document.createElement("canvas");
  canvas.width = template.width;
  canvas.height = template.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error(CANNOT_DRAW);

  return async (code) => {
    drawVoucher(context, {
      template: template.image,
      templateWidth: template.width,
      templateHeight: template.height,
      code,
      style,
      area,
    });
    const blob = await encodeCanvas(canvas, output);
    return new Uint8Array(await blob.arrayBuffer());
  };
}
