import { useEffect, useState } from "react";
import { errorText, getShopifyStatus, subscribeToShopifyStatus } from "./client";
import type { ShopifyStatus } from "./client";

export interface ShopifyStatusState {
  /** Null until the first answer, and when the status could not be read. */
  status: ShopifyStatus | null;
  error: string | null;
}

/** The connection status, read on mount and again after every connect or disconnect attempt. */
export function useShopifyStatus(): ShopifyStatusState {
  const [state, setState] = useState<ShopifyStatusState>({ status: null, error: null });

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      void getShopifyStatus().then(
        (status) => {
          if (mounted) setState({ status, error: null });
        },
        (error: unknown) => {
          if (mounted) setState({ status: null, error: errorText(error) });
        },
      );
    };
    refresh();
    const unsubscribe = subscribeToShopifyStatus(refresh);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return state;
}
