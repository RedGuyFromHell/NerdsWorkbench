// The Voucher tool. Until its screen lands it shows the Shopify connection it depends on: the
// way to Settings when there is none, and the store's collections when there is one. It has no
// connect form of its own: the connection belongs to the whole app.
import { useEffect, useState } from "react";
import { errorText, SHOPIFY_SETTINGS_SECTION } from "../../lib/shopify/client";
import { useShopifyStatus } from "../../lib/shopify/useShopifyStatus";
import { Button } from "../../ui/Button";
import type { ToolContext } from "../types";
import type { Collection } from "./shopify/collections";
import { listCollections } from "./shopify/listCollections";
import "./voucher.css";

export default function VoucherTool({ openSettings }: ToolContext) {
  const { status, error } = useShopifyStatus();

  if (error !== null) {
    return (
      <div className="voucher-notice" role="alert">
        <p>{error}</p>
      </div>
    );
  }
  if (status === null) {
    return (
      <div className="voucher-notice">
        <p>Checking the Shopify connection...</p>
      </div>
    );
  }
  if (!status.connected) {
    return (
      <div className="voucher-notice">
        <p>Not connected - open Settings</p>
        <Button variant="primary" onClick={() => openSettings(SHOPIFY_SETTINGS_SECTION)}>
          Open Settings
        </Button>
      </div>
    );
  }
  return <StoreCollections store={status.store} />;
}

type CollectionsState =
  | { step: "loading" }
  | { step: "loaded"; collections: readonly Collection[] }
  | { step: "failed"; message: string };

function StoreCollections({ store }: { store: string }) {
  const [state, setState] = useState<CollectionsState>({ step: "loading" });

  useEffect(() => {
    let mounted = true;
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
  }, [store]);

  return (
    <div className="voucher-notice">
      <p>Connected to {store}</p>
      {state.step === "loading" ? <p>Loading the collections...</p> : null}
      {state.step === "failed" ? (
        <p role="alert">Could not load the collections: {state.message}</p>
      ) : null}
      {state.step === "loaded" ? (
        <>
          <p>{state.collections.length} collections</p>
          <ul className="voucher-collections">
            {state.collections.map((collection) => (
              <li key={collection.id}>{collection.title}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
