import { Suspense, useState } from "react";
import { getTool, TOOLS } from "../tools/registry";
import type { ToolId } from "../tools/types";
import { HomeGrid } from "./HomeGrid";

export function App() {
  const [activeId, setActiveId] = useState<ToolId | null>(null);
  const [status, setStatus] = useState("");

  if (activeId === null) return <HomeGrid tools={TOOLS} onOpen={setActiveId} />;

  const tool = getTool(activeId);
  return (
    <>
      <button type="button" onClick={() => setActiveId(null)}>
        Home
      </button>
      <h1>{tool.name}</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <tool.component openRequest={null} setStatus={setStatus} />
      </Suspense>
      <p>{status}</p>
    </>
  );
}
