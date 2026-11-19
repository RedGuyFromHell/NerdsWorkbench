// The Voucher Generator screen: the template with the code preview on the left, the three numbered
// settings sections on the right. It joins the settings, the template and the code area; the
// pieces draw and edit them. GENERATE! asks first (`ConfirmRunDialog`), then starts one run
// (`useGenerateRun`); its failure lands in the same Dialog as every other error here.
//
// The settings are not kept between runs, so nothing here is unsaved work, except a run in flight:
// while one is generating, the shell is told (`setUnsavedWork`) and its Save waits for the run to
// end. The screen listens for no keys.
import { useEffect, useState } from "react";
import { errorText } from "../../lib/errors";
import { pickFolder } from "../../lib/files";
import { SHOPIFY_SETTINGS_SECTION } from "../../lib/shopify/client";
import { useShopifyStatus } from "../../lib/shopify/useShopifyStatus";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import type { ToolContext } from "../types";
import { ConfirmRunDialog } from "./ConfirmRunDialog";
import { formatPreviewStatus } from "./core/previewStatus";
import type { ShopifyConnection } from "./DiscountSection";
import { PreviewCanvas } from "./PreviewCanvas";
import { SettingsPanel } from "./SettingsPanel";
import { useCollections } from "./useCollections";
import { useFontFamilies } from "./useFontFamilies";
import { useGenerateConfirm } from "./useGenerateConfirm";
import { useGenerateRun } from "./useGenerateRun";
import { useTemplate } from "./useTemplate";
import { useTemplateDrop } from "./useTemplateDrop";
import { useVoucherSettings } from "./useVoucherSettings";
import "./voucher.css";

export default function VoucherTool({ setStatus, setUnsavedWork, openSettings }: ToolContext) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const shopify = useShopifyStatus();
  const connected = shopify.status?.connected === true;
  const collections = useCollections(connected, shopify.status?.store ?? "");
  const fontFamilies = useFontFamilies(setErrorMessage);
  const generation = useGenerateRun(setErrorMessage);
  const generating = generation.state.kind === "generating";
  const { waitForRun } = generation;

  const { settings, change, sample, style } = useVoucherSettings(fontFamilies);
  const { template, selection, setSelection, chooseTemplate, dropTemplate } = useTemplate({
    locked: generating,
    onError: setErrorMessage,
  });
  const { dropping, dropProps } = useTemplateDrop((file) => void dropTemplate(file));
  const run = useGenerateConfirm({
    settings,
    template,
    selection,
    style,
    connected,
    start: generation.start,
  });

  // WHY: leaving or closing mid-run would stop it before its last image. The shell asks first,
  // and its Save waits until every image is written.
  useEffect(() => {
    if (!generating) return;
    setUnsavedWork({ save: waitForRun });
    return () => setUnsavedWork(null);
  }, [generating, setUnsavedWork, waitForRun]);

  useEffect(() => {
    setStatus(formatPreviewStatus(selection, template, sample));
  }, [setStatus, selection, template, sample]);

  async function chooseFolder() {
    try {
      const folder = await pickFolder({ title: "Choose Save Folder" });
      if (folder !== null) change({ savePath: folder });
    } catch (error) {
      setErrorMessage(errorText(error));
    }
  }

  return (
    <div className={dropping ? "voucher voucher--dropping" : "voucher"} {...dropProps}>
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
        generate={run.check}
        generation={generation.state}
        onGenerate={run.ask}
      />
      {run.confirming ? (
        <ConfirmRunDialog settings={settings} onConfirm={run.confirm} onCancel={run.cancel} />
      ) : null}
      {errorMessage ? (
        <ErrorDialog message={errorMessage} onClose={() => setErrorMessage(null)} />
      ) : null}
    </div>
  );
}

function ErrorDialog({ message, onClose }: { message: string; onClose(): void }) {
  return (
    <Dialog
      title="Voucher Generator"
      onClose={onClose}
      actions={<Button onClick={onClose}>OK</Button>}
    >
      <p>{message}</p>
    </Dialog>
  );
}

function describeConnection(shopify: ReturnType<typeof useShopifyStatus>): ShopifyConnection {
  if (shopify.error !== null) return { kind: "failed", message: shopify.error };
  if (shopify.status === null) return { kind: "checking" };
  return { kind: shopify.status.connected ? "connected" : "disconnected" };
}
