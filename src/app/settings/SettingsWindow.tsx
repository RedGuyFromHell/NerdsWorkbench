import { useEffect, useRef } from "react";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { SectionHeader } from "../../ui/SectionHeader";
import { SETTINGS_SECTIONS } from "./sections";
import type { SettingsContext } from "./sections";

interface SettingsWindowProps extends SettingsContext {
  /** The section to bring into view when the window opens, or null for the top. */
  focusSectionId: string | null;
  onClose(): void;
}

/** App-wide settings in a modal window with the brand-purple bar. Escape closes it. */
export function SettingsWindow({ focusSectionId, onClose, ...context }: SettingsWindowProps) {
  const focusedSection = useRef<HTMLElement>(null);

  // WHY: an effect, not a ref callback: the Dialog opens itself in its own effect, which runs
  // before this one, and a closed <dialog> cannot scroll.
  useEffect(() => {
    focusedSection.current?.scrollIntoView({ block: "start" });
  }, []);

  return (
    <Dialog
      title="Settings"
      colour="brand"
      onClose={onClose}
      actions={<Button onClick={onClose}>Close</Button>}
    >
      {SETTINGS_SECTIONS.map(({ id, title, component: Section }) => (
        <section
          key={id}
          className="settings__section"
          ref={id === focusSectionId ? focusedSection : undefined}
        >
          <SectionHeader title={title} />
          <Section {...context} />
        </section>
      ))}
    </Dialog>
  );
}
