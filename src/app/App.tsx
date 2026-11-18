import { Suspense, useCallback, useRef, useState } from "react";
import { getTool, TOOLS } from "../tools/registry";
import type { OpenRequest, ToolDefinition, ToolId, UnsavedWork } from "../tools/types";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { RetroTitleBar, RetroWindow } from "../ui/RetroWindow";
import { HomeGrid } from "./HomeGrid";
import { useOpenFiles } from "./openFiles";
import { back, currentScreen, forward, startHistory, visit } from "./screenHistory";
import { SettingsWindow } from "./settings/SettingsWindow";
import type { Direction } from "./shellInput";
import { StatusBar } from "./StatusBar";
import { TitleBar } from "./TitleBar";
import { UnsavedDialog } from "./UnsavedDialog";
import { useCloseGuard } from "./useCloseGuard";
import { useExitGuard } from "./useExitGuard";
import { useShellNavigation } from "./useShellNavigation";
import { UpdatePrompt } from "./update/UpdatePrompt";
import { useUpdates } from "./update/useUpdates";

interface ToolHostProps {
  tool: ToolDefinition;
  visible: boolean;
  openRequest: OpenRequest | null;
  onStatus(id: ToolId, text: string): void;
  onUnsavedWork(id: ToolId, work: UnsavedWork | null): void;
}

/** Holds one opened tool. Hiding it (not unmounting) keeps unsaved work alive on the home screen. */
function ToolHost({ tool, visible, openRequest, onStatus, onUnsavedWork }: ToolHostProps) {
  // WHY: stable functions, so a tool can put them in an effect's dependencies without a loop.
  const setStatus = useCallback((text: string) => onStatus(tool.id, text), [onStatus, tool.id]);
  const setUnsavedWork = useCallback(
    (work: UnsavedWork | null) => onUnsavedWork(tool.id, work),
    [onUnsavedWork, tool.id],
  );
  return (
    <div className="tool-host" hidden={!visible} data-colour={tool.colour}>
      {/* The tool's own window bar, in its pastel colour, under the purple shell bar. */}
      <RetroTitleBar title={tool.name} colour={tool.colour} leading={<tool.icon size={20} />} />
      <div className="tool-host__body">
        <Suspense fallback={<p className="tool-host__loading">Loading {tool.name}...</p>}>
          <tool.component
            openRequest={openRequest}
            setStatus={setStatus}
            setUnsavedWork={setUnsavedWork}
          />
        </Suspense>
      </div>
    </div>
  );
}

export function App() {
  const [screens, setScreens] = useState(startHistory);
  const screen = currentScreen(screens);
  const activeId = screen === "home" ? null : screen;
  // Every tool opened so far, in the order of opening. A tool stays here until the app closes.
  const [openedIds, setOpenedIds] = useState<readonly ToolId[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const updates = useUpdates();
  const [statuses, setStatuses] = useState<Partial<Record<ToolId, string>>>({});
  // The file Explorer asked each tool to open, and the message when one could not be opened.
  const [openRequests, setOpenRequests] = useState<Partial<Record<ToolId, OpenRequest>>>({});
  const [openError, setOpenError] = useState<string | null>(null);
  const nextNonce = useRef(0);

  const openTool = useCallback((id: ToolId) => {
    setOpenedIds((current) => (current.includes(id) ? current : [...current, id]));
    setScreens((current) => visit(current, id));
  }, []);

  const showTool = useCallback((id: ToolId) => setScreens((current) => visit(current, id)), []);
  const { prompt, setUnsavedWork, hasUnsavedWork, requestExit, answer } = useExitGuard(showTool);

  // The only ways the screen changes besides opening a tool. Each asks about unsaved work first.
  const goHome = useCallback(
    () =>
      requestExit({ kind: "leave", from: screen, to: "home" }, () =>
        setScreens((current) => visit(current, "home")),
      ),
    [requestExit, screen],
  );
  const move = useCallback(
    (direction: Direction) => {
      const target = currentScreen(direction === "back" ? back(screens) : forward(screens));
      requestExit({ kind: "leave", from: screen, to: target }, () =>
        setScreens((current) => (direction === "back" ? back(current) : forward(current))),
      );
    },
    [requestExit, screen, screens],
  );
  // The window close and "Update now" both end the app, so both ask about every tool.
  const askBeforeEnding = useCallback(
    (proceed: () => void) => requestExit({ kind: "close", on: screen }, proceed),
    [requestExit, screen],
  );
  useCloseGuard(hasUnsavedWork, askBeforeEnding);

  useOpenFiles({
    onOpen: (id, { path }) => {
      nextNonce.current += 1;
      setOpenRequests((current) => ({ ...current, [id]: { path, nonce: nextNonce.current } }));
      openTool(id);
    },
    onError: setOpenError,
  });

  const setToolStatus = useCallback((id: ToolId, text: string) => {
    setStatuses((current) => (current[id] === text ? current : { ...current, [id]: text }));
  }, []);

  const activeTool = activeId === null ? null : getTool(activeId);
  useShellNavigation({ onTool: activeTool !== null, goHome, move });

  return (
    <RetroWindow
      titleBar={<TitleBar onHome={activeTool ? goHome : null} />}
      footer={
        <StatusBar
          text={(activeId === null ? "" : statuses[activeId]) || updates.notice}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      }
    >
      <div className="home-host" hidden={activeTool !== null}>
        <HomeGrid tools={TOOLS} onOpen={openTool} />
      </div>
      {openedIds.map((id) => (
        <ToolHost
          key={id}
          tool={getTool(id)}
          visible={id === activeId}
          openRequest={openRequests[id] ?? null}
          onStatus={setToolStatus}
          onUnsavedWork={setUnsavedWork}
        />
      ))}
      {settingsOpen ? (
        <SettingsWindow checkForUpdates={updates.checkNow} onClose={() => setSettingsOpen(false)} />
      ) : null}
      {openError ? (
        <Dialog
          title="Nerd's Workbench"
          onClose={() => setOpenError(null)}
          actions={<Button onClick={() => setOpenError(null)}>OK</Button>}
        >
          <p>{openError}</p>
        </Dialog>
      ) : null}
      {updates.offered ? (
        <UpdatePrompt
          update={updates.offered}
          onClose={updates.dismiss}
          beforeInstall={askBeforeEnding}
        />
      ) : null}
      {prompt ? (
        <UnsavedDialog
          tool={getTool(prompt.tool)}
          saving={prompt.saving}
          onSave={() => void answer("save")}
          onSkip={() => void answer("skip")}
          onCancel={() => void answer("cancel")}
        />
      ) : null}
    </RetroWindow>
  );
}
