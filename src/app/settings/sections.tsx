// The Settings window is a list of sections. A later slice adds one by writing a component and
// adding one line to SETTINGS_SECTIONS; the window itself does not change.
import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { appVersionLabel } from "../../lib/platform";
import { payoutSection } from "../../tools/payout/settings/payoutSection";
import { Button } from "../../ui/Button";
import { checkResultMessage } from "../update/updateCheck";
import type { UpdateCheckResult } from "../update/updateCheck";

/** What the app gives every section. Grows when a section needs something new. */
export interface SettingsContext {
  checkForUpdates(): Promise<UpdateCheckResult>;
}

export interface SettingsSection {
  id: string;
  title: string;
  component: ComponentType<SettingsContext>;
}

function AboutSection() {
  const [version, setVersion] = useState("");
  useEffect(() => {
    // WHY: in the plain browser preview the version call answers "web preview"; any other failure
    // must not break the window, so it falls back to "unknown".
    void appVersionLabel().then(setVersion, () => setVersion("unknown"));
  }, []);
  return (
    <p>
      Nerd's Workbench <strong>{version}</strong>
      <br />
      The small tools Nerd Castle uses.
    </p>
  );
}

function UpdatesSection({ checkForUpdates }: SettingsContext) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const check = () => {
    setBusy(true);
    setMessage("");
    void checkForUpdates().then((result) => {
      setMessage(checkResultMessage(result));
      setBusy(false);
    });
  };

  return (
    <>
      <div>
        <Button onClick={check} disabled={busy}>
          {busy ? "Checking..." : "Check for updates now"}
        </Button>
      </div>
      <p role="status">{message}</p>
    </>
  );
}

function ShopifySection() {
  return <p className="settings__placeholder">Coming with the Voucher tool.</p>;
}

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { id: "about", title: "About", component: AboutSection },
  { id: "updates", title: "Updates", component: UpdatesSection },
  { id: "shopify", title: "Shopify connection", component: ShopifySection },
  payoutSection,
];
