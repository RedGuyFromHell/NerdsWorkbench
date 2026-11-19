// A label, a text box and a Browse button on one row: the template and the save folder.
import { useId } from "react";
import { Button } from "../../ui/Button";
import { FieldFrame } from "../../ui/Field";

interface PathFieldProps {
  label: string;
  hint?: string;
  value: string;
  placeholder: string;
  /** Without it the box shows the value and the user can only change it with Browse. */
  onChange?: (value: string) => void;
  onBrowse(): void;
}

export function PathField({ label, hint, value, placeholder, onChange, onBrowse }: PathFieldProps) {
  const id = useId();
  return (
    <FieldFrame label={label} hint={hint} htmlFor={id}>
      <div className="path-field">
        <input
          id={id}
          type="text"
          autoComplete="off"
          className="input input--mono"
          value={value}
          placeholder={placeholder}
          readOnly={onChange === undefined}
          onChange={(event) => onChange?.(event.target.value)}
        />
        <Button onClick={onBrowse}>Browse...</Button>
      </div>
    </FieldFrame>
  );
}
