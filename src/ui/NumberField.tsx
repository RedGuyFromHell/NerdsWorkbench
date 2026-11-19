import { useEffect, useId, useState } from "react";
import { FieldFrame } from "./Field";
import { clamp, inRangeNumber, settledNumber } from "./numberInput";

interface NumberFieldProps {
  label: string;
  value: number;
  onChange(value: number): void;
  min?: number;
  max?: number;
  step?: number;
  /** Reports whole numbers only: "7.6" is reported as 8. */
  integer?: boolean;
  /** The decimal places a reported number is rounded to. Unset: as typed. `integer` wins. */
  decimals?: number;
  hint?: string;
}

/** A number input with chunky up and down steppers. Typing is free: a number inside the range is reported as it is typed; text outside it goes back to the last valid value when typing ends. */
export function NumberField({
  label,
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  integer = false,
  decimals,
  hint,
}: NumberFieldProps) {
  const id = useId();
  // The text being typed. It can be "" or "-" while the user types, which is not a number yet.
  const [draft, setDraft] = useState(String(value));
  const places = integer ? 0 : decimals;

  // WHY: the draft stays while it still reads as the value ("12,5" or "7.6" being typed), and
  // follows the value when that changes from outside.
  useEffect(() => {
    setDraft((current) =>
      inRangeNumber(current, min, max, places) === value ? current : String(value),
    );
  }, [value, min, max, places]);

  function finishTyping() {
    const settled = settledNumber(draft, value, { min, max, decimals: places });
    if (settled !== value) onChange(settled);
    setDraft(String(settled));
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
            const typed = inRangeNumber(event.target.value, min, max, places);
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
