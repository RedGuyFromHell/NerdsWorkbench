// The Payout tool: the months on the left, the lines of the chosen month in the middle, the totals
// beside them. An open month's two menus per line are saved through the store (useMonth), and
// Close month locks it for good. Demo data (dev build only) lives in a memory store of its own:
// everything works on it, and nothing reaches the files on the PC.
import { useEffect, useState } from "react";
import { Button } from "../../ui/Button";
import { Tag } from "../../ui/Tag";
import type { ToolContext } from "../types";
import { CloseMonthDialog } from "./CloseMonthDialog";
import { planClose } from "./core/closeMonth";
import type { ClosePlan } from "./core/closeMonth";
import { formatMonthShort, formatMonthTitle } from "./core/monthView";
import type { MonthView } from "./core/monthView";
import { LineTable } from "./LineTable";
import type { OnChoose } from "./LineTable";
import { MonthList } from "./MonthList";
import { getPayoutStore } from "./storage/payoutStore";
import type { PayoutStore } from "./storage/payoutStore";
import { TotalsPanel } from "./TotalsPanel";
import type { MonthFile } from "./storage/monthSchema";
import { useMonth } from "./useMonth";
import type { UseMonth } from "./useMonth";
import { usePaidMarks } from "./usePaidMarks";
import type { PaidMarks } from "./usePaidMarks";
import { usePayoutData } from "./usePayoutData";
import { useStatementExport } from "./useStatementExport";
import type { ExportNote, StatementExporter } from "./useStatementExport";
import type { PayoutData } from "./usePayoutData";
import "./payout.css";

const LOAD_NOT_BUILT_ID = "payout-load-note";

interface HeaderProps {
  title: string;
  /** The status of the month on screen, or null when no month is loaded. */
  status: MonthView["status"] | null;
  isDemo: boolean;
  onLoadDemo: (() => void) | null;
  onCloseDemo: () => void;
  onAskClose: () => void;
}

function Header({ title, status, isDemo, onLoadDemo, onCloseDemo, onAskClose }: HeaderProps) {
  return (
    <div className="payout-header">
      <h1 className="payout-header__title">{title}</h1>
      {status === null ? null : <Tag tone={status === "closed" ? "good" : "warn"}>{status}</Tag>}
      {isDemo ? <Tag tone="warn">demo data, made up</Tag> : null}
      <span className="payout-header__spacer" />
      {isDemo ? <Button onClick={onCloseDemo}>Close demo</Button> : null}
      {onLoadDemo === null || isDemo ? null : <Button onClick={onLoadDemo}>Load demo data</Button>}
      <Button disabled aria-describedby={LOAD_NOT_BUILT_ID}>
        Load from Shopify
      </Button>
      {status === "open" ? <Button onClick={onAskClose}>Close month</Button> : null}
    </div>
  );
}

function FirstMonthNotSet({ onCheckAgain }: { onCheckAgain: () => void }) {
  return (
    <div className="payout-empty" role="status">
      <h2 className="payout-empty__title">The first month is not set</h2>
      <p>
        Open Settings (the gear at the bottom right), find Payout, and type the first month to pay.
        Then come back here and press Check again.
      </p>
      <div>
        <Button onClick={onCheckAgain}>Check again</Button>
      </div>
    </div>
  );
}

/**
 * The month on screen: the one picked in the list, the first one until then, with its two menus,
 * its paid marks and its statements.
 */
function useChosenMonth(data: PayoutData, store: PayoutStore, onRefresh: () => void) {
  const [selected, setSelected] = useState<string | null>(null);
  const month = data.entries.some((entry) => entry.month === selected)
    ? selected
    : (data.entries[0]?.month ?? null);
  const shown = useMonth({
    file: month === null ? null : (data.files.get(month) ?? null),
    settings: data.settings,
    people: data.people,
    store,
    onSettled: onRefresh,
  });
  const { paid, paidError } = usePaidMarks({
    store,
    closedMonth: shown.view?.status === "closed" ? shown.view.month : null,
    marks: data.paidMarks,
    onSettled: onRefresh,
  });
  const { exporter, note } = useStatementExport({
    closed: shown.file?.status === "closed" ? shown.file : null,
    paid,
  });
  const select = (next: string) => {
    setSelected(next);
    onRefresh();
  };
  return { ...shown, month, select, paid, paidError, exporter, note };
}

/** The Close month dialog: asking plans the close afresh, and only a plan that is ready closes. */
function useCloseDialog(file: MonthFile | null, data: PayoutData, close: UseMonth["close"]) {
  const [closePlan, setClosePlan] = useState<ClosePlan | null>(null);
  const { settings, people, entries } = data;
  const askClose = () => {
    if (file === null) return;
    const closedAt = new Date().toISOString();
    setClosePlan(planClose({ file, settings, people, months: entries, closedAt }));
  };
  const confirmClose = () => {
    if (closePlan?.kind === "ready") close(closePlan.closed);
    setClosePlan(null);
  };
  return { closePlan, askClose, confirmClose, cancelClose: () => setClosePlan(null) };
}

function SaveErrors({ errors }: { errors: readonly (string | null)[] }) {
  return errors.map((error) =>
    error === null ? null : (
      <div role="alert" className="payout-notice" key={error}>
        {error}
      </div>
    ),
  );
}

interface MonthScreenProps {
  data: PayoutData;
  store: PayoutStore;
  isDemo: boolean;
  onLoadDemo: (() => void) | null;
  onCloseDemo: () => void;
  onRefresh: () => void;
  setStatus: (text: string) => void;
}

function MonthScreen({
  data,
  store,
  isDemo,
  onLoadDemo,
  onCloseDemo,
  onRefresh,
  setStatus,
}: MonthScreenProps) {
  const chosen = useChosenMonth(data, store, onRefresh);
  const { month, view } = chosen;
  const closing = useCloseDialog(chosen.file, data, chosen.close);
  const { firstMonth } = data.settings;

  useEffect(() => {
    setStatus(view?.statusText ?? "");
  }, [view, setStatus]);

  const title = month === null ? "Payout" : formatMonthTitle(month);

  return (
    <div className="payout">
      <MonthList
        entries={data.entries}
        selected={month}
        onSelect={chosen.select}
        firstMonthText={firstMonth === "" ? "" : formatMonthShort(firstMonth)}
      />
      <main className="payout-main">
        <Header
          title={title}
          status={view?.status ?? null}
          isDemo={isDemo}
          onLoadDemo={onLoadDemo}
          onCloseDemo={onCloseDemo}
          onAskClose={closing.askClose}
        />
        <p id={LOAD_NOT_BUILT_ID} className="payout-muted">
          Loading orders from Shopify is not built yet.
        </p>
        <SaveErrors errors={[chosen.saveError, chosen.paidError]} />
        <MonthContent
          month={month}
          view={view}
          paid={chosen.paid}
          exporter={chosen.exporter}
          note={chosen.note}
          onCheckAgain={onRefresh}
          onChoose={chosen.choose}
        />
      </main>
      {closing.closePlan === null ? null : (
        <CloseMonthDialog
          title={title}
          plan={closing.closePlan}
          onCancel={closing.cancelClose}
          onConfirm={closing.confirmClose}
        />
      )}
    </div>
  );
}

interface MonthContentProps {
  month: string | null;
  view: MonthView | null;
  paid: PaidMarks | null;
  exporter: StatementExporter | null;
  note: ExportNote | null;
  onCheckAgain: () => void;
  onChoose: OnChoose;
}

function MonthContent({
  month,
  view,
  paid,
  exporter,
  note,
  onCheckAgain,
  onChoose,
}: MonthContentProps) {
  if (month === null) return <FirstMonthNotSet onCheckAgain={onCheckAgain} />;
  if (view === null) {
    return (
      <p className="payout-empty" role="status">
        Nothing is loaded for {formatMonthTitle(month)} yet.
      </p>
    );
  }
  return <MonthBody view={view} paid={paid} exporter={exporter} note={note} onChoose={onChoose} />;
}

interface MonthBodyProps {
  view: MonthView;
  paid: PaidMarks | null;
  exporter: StatementExporter | null;
  note: ExportNote | null;
  onChoose: OnChoose;
}

function MonthBody({ view, paid, exporter, note, onChoose }: MonthBodyProps) {
  return (
    <>
      <p className="payout-muted">
        Loaded {view.loadedText} · {view.lineCount} lines from {view.orderCount} orders · amounts in
        lei, without tax
      </p>
      {view.closedText === null ? null : (
        <p className="payout-locked" role="status">
          Closed {view.closedText}. The month is locked: it shows what was saved then, and nothing
          in it changes.
        </p>
      )}
      {note === null ? null : (
        <p
          className={note.kind === "error" ? "payout-notice" : "payout-muted"}
          role={note.kind === "error" ? "alert" : "status"}
        >
          {note.text}
        </p>
      )}
      {view.notices.length === 0 ? null : (
        <div role="alert" className="payout-notice">
          <ul>
            {view.notices.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="payout-body">
        <LineTable
          title={view.title}
          orders={view.orders}
          readOnly={view.status === "closed"}
          onChoose={onChoose}
        />
        <TotalsPanel view={view} paid={paid} exporter={exporter} />
      </div>
    </>
  );
}

export default function PayoutTool({ setStatus }: ToolContext) {
  const [demoStore, setDemoStore] = useState<PayoutStore | null>(null);
  const store = demoStore ?? getPayoutStore();
  const { state, reload } = usePayoutData(store);

  // WHY: the demo module is imported only inside this dev check, so a release build drops it.
  const loadDemo = async () => {
    if (import.meta.env.DEV) {
      const { createDemoStore } = await import("./demo/demoMonth");
      setDemoStore(await createDemoStore());
    }
  };

  if (state.kind === "loading")
    return (
      <p className="payout-empty" role="status">
        Loading...
      </p>
    );
  if (state.kind === "failed") {
    return (
      <div className="payout-empty" role="alert">
        <h2 className="payout-empty__title">The payout files could not be read</h2>
        <p>{state.message}</p>
        <p className="payout-muted">The files are left as they are.</p>
        <div>
          <Button onClick={reload}>Try again</Button>
        </div>
      </div>
    );
  }
  return (
    <MonthScreen
      data={state.data}
      store={store}
      isDemo={demoStore !== null}
      onLoadDemo={import.meta.env.DEV ? () => void loadDemo() : null}
      onCloseDemo={() => setDemoStore(null)}
      onRefresh={reload}
      setStatus={setStatus}
    />
  );
}
