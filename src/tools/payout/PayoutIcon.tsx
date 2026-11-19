// A banknote with a coin in the middle, in the retro line style. The fill comes from the tile through --icon-fill.
export function PayoutIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="11" width="40" height="26" rx="3" fill="var(--icon-fill, var(--field))" />
      <circle cx="24" cy="24" r="7" />
      <path d="M10 18v.01M38 30v.01" />
    </svg>
  );
}
