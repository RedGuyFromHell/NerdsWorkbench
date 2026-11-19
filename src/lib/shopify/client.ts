// The app-wide Shopify connection as the page sees it. Every call goes to a Rust command; the
// token and the client secret stay in Rust (src-tauri/src/shopify/), so nothing here can read
// them. In a plain browser (the Vite URL) the status says "not connected" and every other call
// throws one clear error, so the screens can still be looked at.
import { z } from "zod";
import { errorText } from "../errors";
import { invokeCommand, isTauri } from "../platform";

/** The id of the Settings window section that holds the connection. */
export const SHOPIFY_SETTINGS_SECTION = "shopify";

const DESKTOP_ONLY = "Shopify can only be connected in the desktop app.";

const statusSchema = z.object({
  store: z.string(),
  clientId: z.string(),
  apiVersion: z.string(),
  /** The secrets themselves never reach the page, only whether they are stored. */
  hasClientSecret: z.boolean(),
  connected: z.boolean(),
  importedOldConfig: z.boolean(),
  importError: z.string().nullable(),
});

export type ShopifyStatus = z.infer<typeof statusSchema>;

const NOT_SET_UP: ShopifyStatus = {
  store: "",
  clientId: "",
  apiVersion: "",
  hasClientSecret: false,
  connected: false,
  importedOldConfig: false,
  importError: null,
};

export interface ShopifyAppDetails {
  store: string;
  clientId: string;
  /** Empty keeps the secret that is already stored. */
  clientSecret: string;
}

// WARNING: the same words as `read_graphql_response` in src-tauri/src/shopify/graphql.rs. A
// Rust command can only reject with a sentence, so this prefix is how the page tells a GraphQL
// error from a lost connection. Change both together.
const GRAPHQL_ERROR_PREFIX = "Shopify GraphQL error:";

/**
 * True when Shopify answered the call and refused it with GraphQL errors. False for every
 * failure that leaves the outcome unknown: no answer, a timeout, an HTTP error.
 */
export function isGraphqlError(error: unknown): boolean {
  return errorText(error).startsWith(GRAPHQL_ERROR_PREFIX);
}

async function callCommand(command: string, args?: Record<string, unknown>): Promise<unknown> {
  if (!isTauri()) throw new Error(DESKTOP_ONLY);
  try {
    return await invokeCommand(command, args);
  } catch (error) {
    throw new Error(errorText(error), { cause: error });
  }
}

// #region Status
const statusListeners = new Set<() => void>();

/** Calls the listener after every connect or disconnect attempt. Returns the unsubscribe function. */
export function subscribeToShopifyStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

function announceStatusChange(): void {
  for (const listener of statusListeners) listener();
}

export async function getShopifyStatus(): Promise<ShopifyStatus> {
  if (!isTauri()) return NOT_SET_UP;
  return statusSchema.parse(await callCommand("shopify_status"));
}
// #endregion

// #region Connect and disconnect
/** Saves the app details, then runs the approval in the browser. Resolves once the token is stored. */
export async function connectShopify(details: ShopifyAppDetails): Promise<void> {
  try {
    await callCommand("save_shopify_settings", {
      store: details.store,
      clientId: details.clientId,
    });
    if (details.clientSecret.trim() !== "") {
      await callCommand("save_client_secret", { secret: details.clientSecret });
    }
    await callCommand("shopify_connect");
  } finally {
    // WHY: a failed attempt may still have saved the store or the secret.
    announceStatusChange();
  }
}

/** Removes the token and the client secret from Windows Credential Manager. */
export async function disconnectShopify(): Promise<void> {
  try {
    await callCommand("disconnect");
  } finally {
    announceStatusChange();
  }
}
// #endregion

// #region GraphQL
/** The shape of `shopifyGraphql`, so a caller can be given a stand-in. */
export type GraphqlCall = <T>(
  query: string,
  variables: Record<string, unknown>,
  schema: z.ZodType<T>,
) => Promise<T>;

/** One Admin API query or mutation. The schema turns Shopify's `data` into a typed value. */
export async function shopifyGraphql<T>(
  query: string,
  variables: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T> {
  return schema.parse(await callCommand("shopify_graphql", { query, variables }));
}
// #endregion
