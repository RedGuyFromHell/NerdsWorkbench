import { useEffect, useState } from "react";
import { errorText } from "../../lib/shopify/client";
import type { Collection } from "./shopify/collections";
import { listCollections } from "./shopify/listCollections";

export type CollectionsState =
  | { step: "idle" }
  | { step: "loading" }
  | { step: "loaded"; collections: readonly Collection[] }
  | { step: "failed"; message: string };

/** The store's collections, loaded once the connection is up and again when the store changes. */
export function useCollections(connected: boolean, store: string): CollectionsState {
  const [state, setState] = useState<CollectionsState>({ step: "idle" });

  useEffect(() => {
    if (!connected) {
      setState({ step: "idle" });
      return;
    }
    let mounted = true;
    setState({ step: "loading" });
    void listCollections().then(
      (collections) => {
        if (mounted) setState({ step: "loaded", collections });
      },
      (error: unknown) => {
        if (mounted) setState({ step: "failed", message: errorText(error) });
      },
    );
    return () => {
      mounted = false;
    };
  }, [connected, store]);

  return state;
}
