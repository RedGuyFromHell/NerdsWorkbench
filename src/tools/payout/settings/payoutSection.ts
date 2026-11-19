// The Payout entry of `SETTINGS_SECTIONS`: one value, so the settings list takes one import and one line.
import { PayoutSettingsSection } from "./PayoutSettingsSection";
import { PAYOUT_SETTINGS_SECTION } from "./sectionId";

export const payoutSection = {
  id: PAYOUT_SETTINGS_SECTION,
  title: "Payout",
  component: PayoutSettingsSection,
};
