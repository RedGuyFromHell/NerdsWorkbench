interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange(checked: boolean): void;
  disabled?: boolean;
  /** Draws only the box; the label stays for screen readers. For a row that has its own text. */
  boxOnly?: boolean;
}

export function Checkbox({ label, checked, onChange, disabled, boxOnly }: CheckboxProps) {
  return (
    <label className={boxOnly ? "checkbox checkbox--box-only" : "checkbox"}>
      <input
        type="checkbox"
        className="checkbox__input"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="checkbox__box" aria-hidden="true">
        <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor">
          <path d="M2 6.5l3 3 5-7" strokeWidth="2.4" strokeLinecap="square" />
        </svg>
      </span>
      <span className="checkbox__label">{label}</span>
    </label>
  );
}
