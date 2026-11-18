import { useEffect, useId, useState } from "react";
import { FieldFrame } from "./Field";
import { clamp, clampedNumber, inRangeNumber } from "./numberInput";

interface NumberFieldProps {
  label: string;
  value: number;
  onChange(value: number): void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}

/** A number input with chunky up and down steppers. Typing is free: a number inside the range is reported as it is typed, the rest is clamped when typing ends. */
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

  function finishTyping() {
    const clamped = clampedNumber(draft, min, max);
    if (clamped !== null) onChange(clamped);
    setDraft(String(clamped ?? value));
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
            const typed = inRangeNumber(event.target.value, min, max);
            if (typed !== null) onChange(typed);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") finishTyping();
          }}
          onBlur={finishTyping}
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
