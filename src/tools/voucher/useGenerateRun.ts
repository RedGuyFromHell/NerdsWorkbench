// The GENERATE! button's state and the one place a run starts: it hands the real Shopify call,
// the real file writer and the canvas renderer to `runGenerate`.
import { useCallback, useEffect, useRef, useState } from "react";
import { writeFileBytes } from "../../lib/files";
import { errorText, shopifyGraphql } from "../../lib/shopify/client";
import { runGenerate, type GenerateOutcome, type GenerateProgress } from "./core/generateRun";
import { getOutputFile } from "./core/outputFile";
import type { VoucherSettings } from "./core/voucherSettings";
import { makeImageRenderer, type VoucherLook } from "./voucherImages";

export type GenerateState =
  | { kind: "idle" }
  | { kind: "generating"; progress: GenerateProgress }
  | { kind: "done"; outcome: GenerateOutcome };

// How long the button says DONE! before it offers the next run, as in the old app.
const DONE_SHOWN_MS = 2200;
const IDLE: GenerateState = { kind: "idle" };

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

/** `onError` gets the message of a failed run and must be stable. */
export function useGenerateRun(onError: (message: string) => void) {
  const [state, setState] = useState<GenerateState>(IDLE);
  const abortRef = useRef<AbortController | null>(null);
  const doneTimerRef = useRef<number | undefined>(undefined);

  // WHY: the tool only unmounts when the window goes. A run still going then stops before its
  // next image; the discount and the codes file are already whole.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      window.clearTimeout(doneTimerRef.current);
    },
    [],
  );

  const start = useCallback(
    async (settings: VoucherSettings, look: VoucherLook) => {
      if (abortRef.current !== null) return;
      const abort = new AbortController();
      abortRef.current = abort;
      window.clearTimeout(doneTimerRef.current);
      setState({ kind: "generating", progress: { stage: "codes" } });
      try {
        const output = getOutputFile(look.template.path);
        const outcome = await runGenerate(
          { settings, output },
          {
            graphql: shopifyGraphql,
            writeFile: writeFileBytes,
            renderImage: await makeImageRenderer(look, output),
            onProgress: (progress) => setState({ kind: "generating", progress }),
            signal: abort.signal,
            sleep,
          },
        );
        if (outcome.aborted) return;
        setState({ kind: "done", outcome });
        doneTimerRef.current = window.setTimeout(() => setState(IDLE), DONE_SHOWN_MS);
      } catch (error) {
        setState(IDLE);
        onError(errorText(error));
      } finally {
        abortRef.current = null;
      }
    },
    [onError],
  );

  return { state, start };
}
