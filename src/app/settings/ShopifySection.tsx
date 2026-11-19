// The "Shopify connection" section of the Settings window: the store, the app's client id and
// secret, Connect and Disconnect. The secret is typed here once and sent to Rust; it never comes
// back, so the field is always empty when the window opens.
import { useEffect, useRef, useState } from "react";
import { errorText } from "../../lib/errors";
import { connectShopify, disconnectShopify } from "../../lib/shopify/client";
import type { ShopifyStatus } from "../../lib/shopify/client";
import { useShopifyStatus } from "../../lib/shopify/useShopifyStatus";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";

type Activity = "connecting" | "disconnecting";

const CONNECTED_MESSAGE = "Connected. The token is stored in Windows Credential Manager.";
const DISCONNECTED_MESSAGE =
  "Disconnected. The token and the client secret were removed from this PC only. " +
  "The token stays valid on Shopify until the app is uninstalled in the Shopify admin.";

export function ShopifySection() {
  const { status, error } = useShopifyStatus();
  if (error !== null) {
    return (
      <p className="settings__error" role="alert">
        {error}
      </p>
    );
  }
  if (status === null) return <p className="settings__placeholder">Checking the connection...</p>;
  return <ShopifyForm status={status} />;
}

/** Runs a connect or a disconnect and holds what the form shows about it: busy, done, or failed. */
function useConnectionAttempt(onDone: () => void) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");

  const run = (started: Activity, work: () => Promise<void>, doneMessage: string) => {
    setActivity(started);
    setMessage("");
    setFailure("");
    void work()
      .then(
        () => {
          onDone();
          setMessage(doneMessage);
        },
        (error: unknown) => setFailure(errorText(error)),
      )
      .finally(() => setActivity(null));
  };

  return { activity, message, failure, run };
}

function ShopifyForm({ status }: { status: ShopifyStatus }) {
  const [store, setStore] = useState(status.store);
  const [clientId, setClientId] = useState(status.clientId);
  const [clientSecret, setClientSecret] = useState("");
  const { activity, message, failure, run } = useConnectionAttempt(() => setClientSecret(""));

  const connect = () =>
    run("connecting", () => connectShopify({ store, clientId, clientSecret }), CONNECTED_MESSAGE);
  const disconnect = () => run("disconnecting", disconnectShopify, DISCONNECTED_MESSAGE);

  const hasSecret = clientSecret.trim() !== "" || status.hasClientSecret;
  const canConnect = store.trim() !== "" && clientId.trim() !== "" && hasSecret;
  const busy = activity !== null;

  return (
    <>
      <p className="settings__state" data-connected={status.connected}>
        {status.connected ? `Connected to ${status.store}` : "Not connected"}
      </p>
      <ImportNotes status={status} />
      <Field
        label="Store"
        value={store}
        onChange={setStore}
        placeholder="your-store.myshopify.com"
        mono
        disabled={busy}
      />
      <Field label="Client ID" value={clientId} onChange={setClientId} mono disabled={busy} />
      <Field
        label="Client secret"
        type="password"
        value={clientSecret}
        onChange={setClientSecret}
        hint={status.hasClientSecret ? "saved; leave empty to keep it" : undefined}
        mono
        disabled={busy}
      />
      <p className="settings__note">
        Connect opens Shopify in your browser. Approve the app there within two minutes. The
        app&apos;s redirect URL in Shopify must be <code>http://localhost:8765/callback</code>.
      </p>
      <div className="settings__actions">
        <Button variant="primary" onClick={connect} disabled={busy || !canConnect}>
          {connectLabel(activity, status.connected)}
        </Button>
        <Button
          onClick={disconnect}
          disabled={busy || !(status.connected || status.hasClientSecret)}
        >
          Disconnect
        </Button>
      </div>
      <AttemptFeedback message={message} failure={failure} />
    </>
  );
}

function ImportNotes({ status }: { status: ShopifyStatus }) {
  return (
    <>
      {status.importedOldConfig ? (
        <p className="settings__note">
          The Shopify settings of the old Workbench were imported. Its token and client secret moved
          to Windows Credential Manager, and the old config file no longer holds them.
        </p>
      ) : null}
      {status.importError !== null ? (
        <p className="settings__error" role="alert">
          The old Workbench settings were not imported: {status.importError}
        </p>
      ) : null}
    </>
  );
}

function AttemptFeedback({ message, failure }: { message: string; failure: string }) {
  const feedback = useRef<HTMLDivElement>(null);

  // WHY: the outcome lands under the buttons, which can be below the fold of the Settings window.
  useEffect(() => {
    if (message !== "" || failure !== "") feedback.current?.scrollIntoView({ block: "nearest" });
  }, [message, failure]);

  return (
    <div ref={feedback}>
      <p role="status">{message}</p>
      {failure !== "" ? (
        <p className="settings__error" role="alert">
          {failure}
        </p>
      ) : null}
    </div>
  );
}

function connectLabel(activity: Activity | null, connected: boolean): string {
  if (activity === "connecting") return "Waiting for the browser...";
  return connected ? "Connect again" : "Connect to Shopify";
}
