// Files opened from Explorer: the Rust side queues the paths (src-tauri/src/open_files.rs) and
// sends the "open-file" event; this hook takes the queue on mount and again on every event, decides
// the tool for each path (routeOpenFile) and hands it to the app. Thin on purpose: the decision is
// in routeOpenFile.ts, where it has tests.
import { useEffect, useRef } from "react";
import { fileNameOf, PROJECT_EXTENSION, readFileBytes } from "../lib/files";
import { invokeCommand, isTauri } from "../lib/platform";
import type { OpenRequest, ToolId } from "../tools/types";
import { routeOpenFile, toolFieldOf } from "./routeOpenFile";

const OPEN_FILE_EVENT = "open-file";

export interface OpenFileHandlers {
  /** A path is ready to open in this tool. */
  onOpen(toolId: ToolId, request: Omit<OpenRequest, "nonce">): void;
  /** A path could not be opened; the message is for a dialog. */
  onError(message: string): void;
}

/** Decides where one path goes, reading the file when its tool field is needed. */
async function handlePath(path: string, handlers: OpenFileHandlers): Promise<void> {
  try {
    let toolField: unknown;
    if (path.toLowerCase().endsWith(PROJECT_EXTENSION)) {
      toolField = toolFieldOf(new TextDecoder().decode(await readFileBytes(path)));
    }
    const route = routeOpenFile(path, toolField);
    if (route.ok) handlers.onOpen(route.toolId, { path });
    else handlers.onError(route.message);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    handlers.onError(`${fileNameOf(path)} could not be opened. ${reason}`);
  }
}

/** Opens the files Explorer passed to the app, at start and while it runs. Desktop only. */
export function useOpenFiles(handlers: OpenFileHandlers): void {
  // WHY: the latest handlers without listening again whenever the app renders.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | null = null;
    // WHY: one drain at a time, so two quick events keep their order.
    let draining: Promise<void> = Promise.resolve();

    const drain = async () => {
      const paths = await invokeCommand<string[]>("take_pending_open_files");
      for (const path of paths) await handlePath(path, handlersRef.current);
    };
    const queueDrain = () => {
      draining = draining.then(drain).catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error);
        handlersRef.current.onError(`Could not open the file. ${reason}`);
      });
    };

    void (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      // WHY: listen first, then take: a path that arrives in between is taken by the event.
      const stop = await listen(OPEN_FILE_EVENT, queueDrain);
      if (disposed) stop();
      else unlisten = stop;
      queueDrain();
    })();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
}
