import type { ToolDefinition, ToolId } from "../tools/types";

interface HomeGridProps {
  tools: readonly ToolDefinition[];
  onOpen(id: ToolId): void;
}

export function HomeGrid({ tools, onOpen }: HomeGridProps) {
  return (
    <ul>
      {tools.map((tool) => (
        <li key={tool.id}>
          <button type="button" onClick={() => onOpen(tool.id)}>
            <tool.icon size={48} />
            <span>{tool.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
