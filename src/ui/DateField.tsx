import { useId } from "react";
import { FieldFrame } from "./Field";

interface DateFieldProps {
  label: string;
  /** A local date as `yyyy-mm-dd`, or "" for none. */
  value: string;
  onChange(value: string): void;
  hint?: string;
}

/** A labelled date input, in the same frame as the other fields. */
export function DateField({ label, value, onChange, hint }: DateFieldProps) {
  const id = useId();
  return (
    <FieldFrame label={label} hint={hint} htmlFor={id}>
      <input
        id={id}
        type="date"
        className="input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldFrame>
  );
}
