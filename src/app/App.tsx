import { Suspense, useCallback, useState } from "react";
import { getTool, TOOLS } from "../tools/registry";
import type { ToolDefinition, ToolId } from "../tools/types";
import { RetroTitleBar, RetroWindow } from "../ui/RetroWindow";
import { HomeGrid } from "./HomeGrid";
import { SettingsWindow } from "./settings/SettingsWindow";
import { StatusBar } from "./StatusBar";
import { TitleBar } from "./TitleBar";
import { UpdatePrompt } from "./update/UpdatePrompt";
import { useUpdates } from "./update/useUpdates";

interface ToolHostProps {
  tool: ToolDefinition;
  visible: boolean;
  onStatus(id: ToolId, text: string): void;
}

/** Holds one opened tool. Hiding it (not unmounting) keeps unsaved work alive on the home screen. */
function ToolHost({ tool, visible, onStatus }: ToolHostProps) {
  // WHY: a stable function, so a tool can put it in an effect's dependencies without a loop.
  const setStatus = useCallback((text: string) => onStatus(tool.id, text), [onStatus, tool.id]);
  return (
    <div className="tool-host" hidden={!visible} data-colour={tool.colour}>
      {/* The tool's own window bar, in its pastel colour, under the purple shell bar. */}
      <RetroTitleBar title={tool.name} colour={tool.colour} leading={<tool.icon size={20} />} />
      <div className="tool-host__body">
        <Suspense fallback={<p className="tool-host__loading">Loading {tool.name}...</p>}>
          <tool.component openRequest={null} setStatus={setStatus} />
        </Suspense>
      </div>
    </div>
  );
}

export function App() {
  const [activeId, setActiveId] = useState<ToolId | null>(null);
  // Every tool opened so far, in the order of opening. A tool stays here until the app closes.
  const [openedIds, setOpenedIds] = useState<readonly ToolId[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const updates = useUpdates();
  const [statuses, setStatuses] = useState<Partial<Record<ToolId, string>>>({});

  const openTool = useCallback((id: ToolId) => {
    setOpenedIds((current) => (current.includes(id) ? current : [...current, id]));
    setActiveId(id);
  }, []);

  const setToolStatus = useCallback((id: ToolId, text: string) => {
    setStatuses((current) => (current[id] === text ? current : { ...current, [id]: text }));
  }, []);

  const activeTool = activeId === null ? null : getTool(activeId);

  return (
    <RetroWindow
      titleBar={<TitleBar onHome={activeTool ? () => setActiveId(null) : null} />}
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
        <ToolHost key={id} tool={getTool(id)} visible={id === activeId} onStatus={setToolStatus} />
      ))}
      {settingsOpen ? (
        <SettingsWindow checkForUpdates={updates.checkNow} onClose={() => setSettingsOpen(false)} />
      ) : null}
      {updates.offered ? <UpdatePrompt update={updates.offered} onClose={updates.dismiss} /> : null}
    </RetroWindow>
  );
}
