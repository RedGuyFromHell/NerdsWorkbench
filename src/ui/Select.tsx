import { useId } from "react";
import { FieldFrame } from "./Field";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange(value: string): void;
  hint?: string;
  disabled?: boolean;
}

export function Select({ label, value, options, onChange, hint, disabled }: SelectProps) {
  const id = useId();
  return (
    <FieldFrame label={label} hint={hint} htmlFor={id}>
      <select
        id={id}
        className="input input--select"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldFrame>
  );
}
