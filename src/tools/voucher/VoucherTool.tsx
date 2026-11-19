// The Voucher Generator screen: the template with the code preview on the left, the three numbered
// settings sections on the right. It holds the settings, the template and the code area; the
// pieces draw and edit them. GENERATE! asks first (`ConfirmRunDialog`), then starts one run
// (`useGenerateRun`); its failure lands in the same Dialog as every other error here.
//
// The settings are not kept between runs, so nothing here is unsaved work, except a run in flight:
// while one is generating, the shell is told (`setUnsavedWork`) and its Save waits for the run to
// end. The screen listens for no keys.
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { pickFolder, pickOpenFile } from "../../lib/files";
import { errorText, SHOPIFY_SETTINGS_SECTION } from "../../lib/shopify/client";
import { useShopifyStatus } from "../../lib/shopify/useShopifyStatus";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import type { ToolContext } from "../types";
import { ConfirmRunDialog } from "./ConfirmRunDialog";
import { generateCodes } from "./core/codeGen";
import { checkCanGenerate } from "./core/generateGuard";
import { formatPreviewStatus } from "./core/previewStatus";
import { toImagePixels, type Rect } from "./core/selection";
import { isTemplateFileName, TEMPLATE_EXTENSIONS } from "./core/templateFile";
import {
  defaultVoucherSettings,
  pickFontFamily,
  toCodeStyle,
  type VoucherSettings,
} from "./core/voucherSettings";
import type { ShopifyConnection } from "./DiscountSection";
import { PreviewCanvas } from "./PreviewCanvas";
import { SettingsPanel } from "./SettingsPanel";
import { loadTemplateFromFile, loadTemplateFromPath, type VoucherTemplate } from "./template";
import { useCollections } from "./useCollections";
import { useFontFamilies } from "./useFontFamilies";
import { useGenerateRun } from "./useGenerateRun";
import "./voucher.css";

function carriesFiles(event: DragEvent): boolean {
  return event.dataTransfer.types.includes("Files");
}

// WHY: the sample changes only when something that shapes the code changes, so the font, size and
// colour can be judged on the same letters.
function makeSample(prefix: string, length: number, numbersOnly: boolean): string {
  return generateCodes({ prefix, length, count: 1, numbersOnly })[0] ?? prefix;
}

export default function VoucherTool({ setStatus, setUnsavedWork, openSettings }: ToolContext) {
  const [settings, setSettings] = useState(() => defaultVoucherSettings(new Date()));
  const [template, setTemplate] = useState<VoucherTemplate | null>(null);
  const [selection, setSelection] = useState<Rect | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const templateRef = useRef<VoucherTemplate | null>(null);

  const shopify = useShopifyStatus();
  const connected = shopify.status?.connected === true;
  const collections = useCollections(connected, shopify.status?.store ?? "");
  const fontFamilies = useFontFamilies(setErrorMessage);
  const generation = useGenerateRun(setErrorMessage);
  const generating = generation.state.kind === "generating";
  const { waitForRun } = generation;

  // WHY: leaving or closing mid-run would stop it before its last image. The shell asks first,
  // and its Save waits until every image is written.
  useEffect(() => {
    if (!generating) return;
    setUnsavedWork({ save: waitForRun });
    return () => setUnsavedWork(null);
  }, [generating, setUnsavedWork, waitForRun]);

  const change = useCallback((patch: Partial<VoucherSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  // The default font is Impact; a machine without it gets its first font, never a silent fallback.
  useEffect(() => {
    if (fontFamilies.length === 0) return;
    setSettings((current) => {
      const fontFamily = pickFontFamily(fontFamilies, current.fontFamily);
      return fontFamily === current.fontFamily ? current : { ...current, fontFamily };
    });
  }, [fontFamilies]);

  const { prefix, randomLength, numbersOnly } = settings;
  const sample = useMemo(
    () => makeSample(prefix, randomLength, numbersOnly),
    [prefix, randomLength, numbersOnly],
  );

  // WHY: only the look of the code, so typing in another field does not redraw the template.
  const { fontFamily, fontSizePx, letterSpacingPx, outlineThicknessPx } = settings;
  const { codeColour, outlineColour } = settings;
  const style = useMemo(
    () =>
      toCodeStyle({
        fontFamily,
        fontSizePx,
        letterSpacingPx,
        outlineThicknessPx,
        codeColour,
        outlineColour,
      }),
    [fontFamily, fontSizePx, letterSpacingPx, outlineThicknessPx, codeColour, outlineColour],
  );

  useEffect(() => {
    setStatus(formatPreviewStatus(selection, template, sample));
  }, [setStatus, selection, template, sample]);

  function showTemplate(next: VoucherTemplate) {
    // WARNING: a run draws every image from the open template. Closing it mid-run would write
    // vouchers with no background.
    if (generating) {
      next.image.close();
      setErrorMessage("The voucher image cannot change while vouchers are being generated.");
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
      setErrorMessage(errorText(error));
    }
  }

  async function chooseFolder() {
    try {
      const folder = await pickFolder({ title: "Choose Save Folder" });
      if (folder !== null) change({ savePath: folder });
    } catch (error) {
      setErrorMessage(errorText(error));
    }
  }

  async function dropTemplate(file: File) {
    if (!isTemplateFileName(file.name)) {
      setErrorMessage(`${file.name}: drop a jpg, png or webp image.`);
      return;
    }
    try {
      showTemplate(await loadTemplateFromFile(file));
    } catch (error) {
      setErrorMessage(`${file.name}: ${errorText(error)}`);
    }
  }

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
    const file = event.dataTransfer.files[0];
    if (file) void dropTemplate(file);
  }

  const generate = checkCanGenerate({
    hasImage: template !== null,
    hasSelection: selection !== null,
    savePath: settings.savePath,
    prefix: settings.prefix,
    connected,
    appliesTo: settings.appliesTo,
    pickedCollectionCount: settings.collectionIds.length,
    startDate: settings.startDate,
    endDate: settings.endDate,
  });

  function startGenerate() {
    setConfirming(false);
    if (!generate.canGenerate || template === null || selection === null) return;
    const bounds = { x: 0, y: 0, width: template.width, height: template.height };
    const area = toImagePixels(selection, bounds, template);
    generation.start(settings, { template, area, style });
  }

  return (
    <div
      className={dropping ? "voucher voucher--dropping" : "voucher"}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <main className="voucher-preview">
        <PreviewCanvas
          template={template}
          selection={selection}
          onSelectionChange={setSelection}
          style={style}
          sample={sample}
        />
      </main>
      <SettingsPanel
        settings={settings}
        onChange={change}
        templatePath={template?.path ?? ""}
        onChooseTemplate={() => void chooseTemplate()}
        onChooseFolder={() => void chooseFolder()}
        fontFamilies={fontFamilies}
        connection={describeConnection(shopify)}
        collections={collections}
        onOpenSettings={() => openSettings(SHOPIFY_SETTINGS_SECTION)}
        generate={generate}
        generation={generation.state}
        onGenerate={() => setConfirming(true)}
      />
      {confirming ? (
        <ConfirmRunDialog
          settings={settings}
          onConfirm={startGenerate}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
      {errorMessage ? (
        <Dialog
          title="Voucher Generator"
          onClose={() => setErrorMessage(null)}
          actions={<Button onClick={() => setErrorMessage(null)}>OK</Button>}
        >
          <p>{errorMessage}</p>
        </Dialog>
      ) : null}
    </div>
  );
}

function describeConnection(shopify: ReturnType<typeof useShopifyStatus>): ShopifyConnection {
  if (shopify.error !== null) return { kind: "failed", message: shopify.error };
  if (shopify.status === null) return { kind: "checking" };
  return { kind: shopify.status.connected ? "connected" : "disconnected" };
}
