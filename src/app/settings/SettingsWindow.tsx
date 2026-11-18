import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { SectionHeader } from "../../ui/SectionHeader";
import { SETTINGS_SECTIONS } from "./sections";
import type { SettingsContext } from "./sections";

interface SettingsWindowProps extends SettingsContext {
  onClose(): void;
}

/** App-wide settings in a modal window with the brand-purple bar. Escape closes it. */
export function SettingsWindow({ onClose, ...context }: SettingsWindowProps) {
  return (
    <Dialog
      title="Settings"
      colour="brand"
      onClose={onClose}
      actions={<Button onClick={onClose}>Close</Button>}
    >
      {SETTINGS_SECTIONS.map(({ id, title, component: Section }) => (
        <section key={id} className="settings__section">
          <SectionHeader title={title} />
          <Section {...context} />
        </section>
      ))}
    </Dialog>
  );
}
