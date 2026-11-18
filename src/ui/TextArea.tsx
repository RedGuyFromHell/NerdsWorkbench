import { useId } from "react";
import { FieldFrame } from "./Field";

interface TextAreaProps {
  label: string;
  value: string;
  onChange(value: string): void;
  rows?: number;
  hint?: string;
}

/** A labelled multi-line text input. */
export function TextArea({ label, value, onChange, rows = 3, hint }: TextAreaProps) {
  const id = useId();
  return (
    <FieldFrame label={label} hint={hint} htmlFor={id}>
      <textarea
        id={id}
        className="input input--area"
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldFrame>
  );
}
