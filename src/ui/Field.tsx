import { useId } from "react";
import type { ReactNode } from "react";

interface FieldFrameProps {
  label: string;
  hint?: string;
  htmlFor: string;
  /** Keep the label for screen readers only: a table cell whose column header already says it. */
  hideLabel?: boolean;
  children: ReactNode;
}

/** The label row above a control. Shared by every field component. */
export function FieldFrame({ label, hint, htmlFor, hideLabel, children }: FieldFrameProps) {
  return (
    <div className="field">
      <label
        className={hideLabel ? "field__label field__label--hidden" : "field__label"}
        htmlFor={htmlFor}
      >
        {label}
        {hint ? <span className="field__hint">{hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange(value: string): void;
  hint?: string;
  placeholder?: string;
  /** Mono text, for codes and paths. */
  mono?: boolean;
  disabled?: boolean;
}

/** A labelled text input. */
export function Field({ label, value, onChange, hint, placeholder, mono, disabled }: FieldProps) {
  const id = useId();
  return (
    <FieldFrame label={label} hint={hint} htmlFor={id}>
      <input
        id={id}
        type="text"
        className={mono ? "input input--mono" : "input"}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldFrame>
  );
}
