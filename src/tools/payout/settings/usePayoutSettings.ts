// Loads the payout settings and people, keeps what the fields hold, and saves on every change
// that has no problem. Saves run one after another, so an older write never lands after a newer one.
import { useCallback, useEffect, useRef, useState } from "react";
import { getPayoutStore } from "../storage/payoutStore";
import { STORAGE_VERSION } from "../storage/schemas";
import { validatePeople, type StoredPerson } from "./peopleForm";
import { settingsFromDraft, settingsToDraft, type SettingsDraft } from "./settingsForm";

interface Loaded {
  draft: SettingsDraft;
  people: StoredPerson[];
}

export type PayoutSettingsState =
  | { kind: "loading" }
  | { kind: "failed"; message: string }
  | {
      kind: "ready";
      draft: SettingsDraft;
      people: StoredPerson[];
      /** What stops the current text from being saved. Empty when it is saved. */
      issues: string[];
      /** Set when the last write to the PC failed. */
      saveError: string;
    };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function usePayoutSettings() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const writes = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const store = getPayoutStore();
    // A file that cannot be read stops the screen: editing over it would replace real data with defaults.
    void Promise.all([store.readSettings(), store.readPeople()]).then(
      ([settings, stored]) =>
        setLoaded({ draft: settingsToDraft(settings), people: stored.people }),
      (error: unknown) => setLoadError(messageOf(error)),
    );
  }, []);

  const queueWrite = useCallback((write: () => Promise<void>) => {
    writes.current = writes.current.then(write).then(
      () => setSaveError(""),
      (error: unknown) => setSaveError(messageOf(error)),
    );
  }, []);

  const changeDraft = useCallback(
    (draft: SettingsDraft) => {
      setLoaded((current) => (current === null ? current : { ...current, draft }));
      const result = settingsFromDraft(draft);
      if (result.ok) queueWrite(() => getPayoutStore().writeSettings(result.settings));
    },
    [queueWrite],
  );

  const changePeople = useCallback(
    (people: StoredPerson[]) => {
      setLoaded((current) => (current === null ? current : { ...current, people }));
      if (validatePeople(people).length === 0) {
        queueWrite(() => getPayoutStore().writePeople({ version: STORAGE_VERSION, people }));
      }
    },
    [queueWrite],
  );

  let state: PayoutSettingsState = { kind: "loading" };
  if (loadError !== "") state = { kind: "failed", message: loadError };
  else if (loaded !== null) {
    const draftResult = settingsFromDraft(loaded.draft);
    const issues = [
      ...(draftResult.ok ? [] : draftResult.issues),
      ...validatePeople(loaded.people),
    ];
    state = { kind: "ready", ...loaded, issues, saveError };
  }
  return { state, changeDraft, changePeople };
}
