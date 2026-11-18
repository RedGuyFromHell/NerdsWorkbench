import { useEffect, useId, useState } from "react";
import { FieldFrame } from "./Field";

interface NumberFieldProps {
  label: string;
  value: number;
  onChange(value: number): void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** A number input with chunky up and down steppers. Typing is free; the value is clamped as it is read. */
export function NumberField({
  label,
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  hint,
}: NumberFieldProps) {
  const id = useId();
  // The text being typed. It can be "" or "-" while the user types, which is not a number yet.
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft((current) => (Number(current) === value ? current : String(value)));
  }, [value]);

  function commit(text: string) {
    const parsed = Number(text);
    if (text.trim() === "" || Number.isNaN(parsed)) return;
    onChange(clamp(parsed, min, max));
  }

  function stepBy(direction: 1 | -1) {
    const next = clamp(value + direction * step, min, max);
    setDraft(String(next));
    onChange(next);
  }

  return (
    <FieldFrame label={label} hint={hint} htmlFor={id}>
      <div className="number-field">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          className="number-field__input"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            commit(event.target.value);
          }}
          onBlur={() => setDraft(String(value))}
        />
        <div className="number-field__steppers">
          <button type="button" aria-label={`Increase ${label}`} onClick={() => stepBy(1)}>
            <svg viewBox="0 0 8 6" width="8" height="6" fill="currentColor" aria-hidden="true">
              <path d="M4 0l4 6H0z" />
            </svg>
          </button>
          <button type="button" aria-label={`Decrease ${label}`} onClick={() => stepBy(-1)}>
            <svg viewBox="0 0 8 6" width="8" height="6" fill="currentColor" aria-hidden="true">
              <path d="M4 6L0 0h8z" />
            </svg>
          </button>
        </div>
      </div>
    </FieldFrame>
  );
}
