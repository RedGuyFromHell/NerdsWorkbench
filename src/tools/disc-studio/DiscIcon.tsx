// A compact disc in the retro line style. The fill comes from the tile through --icon-fill.
export function DiscIcon({ size }: { size: number }) {
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
      <circle cx="24" cy="24" r="20" fill="var(--icon-fill, var(--field))" />
      <circle cx="24" cy="24" r="6" fill="var(--field)" />
      <path d="M12 17a14 14 0 0 1 7-6" />
    </svg>
  );
}
