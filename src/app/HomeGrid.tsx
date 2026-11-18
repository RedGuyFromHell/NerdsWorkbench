import type { ToolDefinition, ToolId } from "../tools/types";
import { SectionHeader } from "../ui/SectionHeader";

interface HomeGridProps {
  tools: readonly ToolDefinition[];
  onOpen(id: ToolId): void;
}

/** The yellow folder behind every tile: a back panel, a tab and a front flap, with a hard shadow. */
function FolderArt() {
  return (
    <svg className="tile__folder" viewBox="0 0 96 76" width="132" height="104" aria-hidden="true">
      <path className="tile__folder-shadow" d="M8 14h28l8 8h48v50H8z" transform="translate(4 4)" />
      <path className="tile__folder-back" d="M8 14h28l8 8h48v50H8z" />
      <path className="tile__folder-front" d="M4 32h88l-6 40H8z" />
    </svg>
  );
}

/** One tile per registry entry, like the folder icons on an old desktop. */
export function HomeGrid({ tools, onOpen }: HomeGridProps) {
  return (
    <div className="home">
      <SectionHeader title="Pick a tool" />
      <ul className="home__grid">
        {tools.map((tool) => (
          <li key={tool.id}>
            <button
              type="button"
              className="tile"
              data-colour={tool.colour}
              onClick={() => onOpen(tool.id)}
            >
              <span className="tile__art">
                <FolderArt />
                <span className="tile__badge">
                  <tool.icon size={44} />
                </span>
              </span>
              <span className="tile__label">{tool.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
