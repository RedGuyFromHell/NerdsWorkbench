import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import type { ToolDefinition } from "../tools/types";

interface UnsavedDialogProps {
  tool: ToolDefinition;
  /** The save is running: the buttons wait for it. */
  saving: boolean;
  onSave(): void;
  onSkip(): void;
  onCancel(): void;
}

/** "<Tool> has changes that are not saved": Save, Don't save, or Cancel the exit. */
export function UnsavedDialog({ tool, saving, onSave, onSkip, onCancel }: UnsavedDialogProps) {
  return (
    <Dialog
      title={tool.name}
      colour={tool.colour}
      // WHY: Escape and the close box mean Cancel, but not while a save is writing.
      onClose={saving ? () => undefined : onCancel}
      actions={
        <>
          <Button variant="primary" disabled={saving} onClick={onSave}>
            Save
          </Button>
          <Button disabled={saving} onClick={onSkip}>
            Don't save
          </Button>
          <Button disabled={saving} onClick={onCancel}>
            Cancel
          </Button>
        </>
      }
    >
      <p>{tool.name} has changes that are not saved.</p>
    </Dialog>
  );
}
