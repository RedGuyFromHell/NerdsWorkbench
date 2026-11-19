// The open template and the code area drawn on it. A new template clears the area, because the
// area is in the old image's pixels. The picker and the drop both end in `showTemplate`.
import { useRef, useState } from "react";
import { errorText } from "../../lib/errors";
import { pickOpenFile } from "../../lib/files";
import { isTemplateFileName, TEMPLATE_EXTENSIONS } from "./core/templateFile";
import type { Rect } from "./core/selection";
import { loadTemplateFromFile, loadTemplateFromPath, type VoucherTemplate } from "./template";

interface TemplateOptions {
  /** True while a run is drawing every image from the open template. */
  locked: boolean;
  onError(message: string): void;
}

export function useTemplate({ locked, onError }: TemplateOptions) {
  const [template, setTemplate] = useState<VoucherTemplate | null>(null);
  const [selection, setSelection] = useState<Rect | null>(null);
  const templateRef = useRef<VoucherTemplate | null>(null);

  function showTemplate(next: VoucherTemplate) {
    // WARNING: a run draws every image from the open template. Closing it mid-run would write
    // vouchers with no background.
    if (locked) {
      next.image.close();
      onError("The voucher image cannot change while vouchers are being generated.");
      return;
    }
    templateRef.current?.image.close();
    templateRef.current = next;
    setTemplate(next);
    setSelection(null);
  }

  async function chooseTemplate() {
    try {
      const path = await pickOpenFile({
        title: "Choose Voucher Image",
        filters: [{ name: "Images", extensions: TEMPLATE_EXTENSIONS }],
      });
      if (path !== null) showTemplate(await loadTemplateFromPath(path));
    } catch (error) {
      onError(errorText(error));
    }
  }

  async function dropTemplate(file: File) {
    if (!isTemplateFileName(file.name)) {
      onError(`${file.name}: drop a jpg, png or webp image.`);
      return;
    }
    try {
      showTemplate(await loadTemplateFromFile(file));
    } catch (error) {
      onError(`${file.name}: ${errorText(error)}`);
    }
  }

  return { template, selection, setSelection, chooseTemplate, dropTemplate };
}
