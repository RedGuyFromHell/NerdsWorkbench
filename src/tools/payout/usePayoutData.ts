// Loads what the month screen reads: Settings, the people, the paid marks and every month file. A file that cannot
// be read stops the screen with its message: showing the rest would hide real data behind defaults.
import { useCallback, useEffect, useState } from "react";
import { buildMonthList } from "./core/monthList";
import type { MonthEntry } from "./core/monthList";
import { monthOf } from "./core/orderMonth";
import type { PayoutStore } from "./storage/payoutStore";
import { monthFileSchema } from "./storage/monthSchema";
import type { MonthFile } from "./storage/monthSchema";
import type { PayoutSettings, StoredPaidMarks, StoredPeople } from "./storage/schemas";

export interface PayoutData {
  settings: PayoutSettings;
  people: StoredPeople;
  paidMarks: StoredPaidMarks["marks"];
  files: ReadonlyMap<string, MonthFile>;
  entries: MonthEntry[];
}

export type PayoutDataState =
  { kind: "loading" } | { kind: "failed"; message: string } | { kind: "ready"; data: PayoutData };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The month it is now on this PC, which is not always the month in the time zone of the shop. */
function currentMonthKey(): string {
  const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return monthOf(new Date().toISOString(), deviceTimeZone);
}

async function readPayoutData(store: PayoutStore): Promise<PayoutData> {
  const [settings, people, paidMarks, monthKeys] = await Promise.all([
    store.readSettings(),
    store.readPeople(),
    store.readPaidMarks(),
    store.listMonthKeys(),
  ]);
  const files = new Map<string, MonthFile>();
  for (const month of monthKeys) {
    const file = await store.readMonth(month, monthFileSchema);
    if (file !== null) files.set(month, file);
  }
  const entries = buildMonthList({
    firstMonth: settings.firstMonth,
    currentMonth: currentMonthKey(),
    files: [...files.values()].map((file) => ({ month: file.month, status: file.status })),
  });
  return { settings, people, paidMarks: paidMarks.marks, files, entries };
}

/** `store` is the app's own store, or the memory store of the demo. A new store is read at once. */
export function usePayoutData(store: PayoutStore): { state: PayoutDataState; reload(): void } {
  const [loaded, setLoaded] = useState<{ store: PayoutStore; state: PayoutDataState } | null>(null);
  const [reloads, setReloads] = useState(0);
  // WHY: what was read from one store is never shown over another. Between the demo and the real
  // files the screen is "loading", so no click can write one store with the data of the other.
  const state: PayoutDataState = loaded?.store === store ? loaded.state : { kind: "loading" };

  useEffect(() => {
    let isCurrent = true;
    void readPayoutData(store).then(
      (data) => isCurrent && setLoaded({ store, state: { kind: "ready", data } }),
      (error: unknown) =>
        isCurrent && setLoaded({ store, state: { kind: "failed", message: messageOf(error) } }),
    );
    return () => {
      isCurrent = false;
    };
  }, [store, reloads]);

  const reload = useCallback(() => setReloads((count) => count + 1), []);

  // WHY: the tool stays mounted while Settings is open on top of it, so a changed first month or
  // rate is only seen when the window gets the focus back.
  useEffect(() => {
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [reload]);

  return { state, reload };
}
