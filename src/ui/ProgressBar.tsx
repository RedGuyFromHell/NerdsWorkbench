interface ProgressBarProps {
  /** 0 to 1, or null when the total is not known (the bar then shows a moving stripe). */
  value: number | null;
  label?: string;
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  const percent = value === null ? null : Math.round(Math.min(1, Math.max(0, value)) * 100);
  const caption = [label, percent === null ? null : `${percent}%`].filter(Boolean).join(" ");
  return (
    <div className="progress">
      <div
        className="progress__track"
        role="progressbar"
        aria-label={label ?? "Progress"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
      >
        <div
          className={
            percent === null ? "progress__fill progress__fill--indeterminate" : "progress__fill"
          }
          style={percent === null ? undefined : { width: `${percent}%` }}
        />
      </div>
      {caption ? <span className="progress__label">{caption}</span> : null}
    </div>
  );
}
