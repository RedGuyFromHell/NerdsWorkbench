import { useId } from "react";
import { FieldFrame } from "./Field";

interface ColorFieldProps {
  label: string;
  /** A CSS colour such as "#4a265a". It is the user's own data, not a theme colour. */
  value: string;
  onChange(value: string): void;
  hint?: string;
}

export function ColorField({ label, value, onChange, hint }: ColorFieldProps) {
  const id = useId();
  return (
    <FieldFrame label={label} hint={hint} htmlFor={id}>
      <div className="color-field">
        <span className="color-field__swatch" style={{ background: value }} />
        <span className="color-field__value">{value.toUpperCase()}</span>
        <input
          id={id}
          type="color"
          className="color-field__input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </FieldFrame>
  );
}
