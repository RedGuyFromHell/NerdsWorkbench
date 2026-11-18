// A ticket with a perforation, in the retro line style. The fill comes from the tile through --icon-fill.
export function VoucherIcon({ size }: { size: number }) {
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
      <path
        d="M5 12h38v8a4 4 0 0 0 0 8v8H5v-8a4 4 0 0 0 0-8z"
        fill="var(--icon-fill, var(--field))"
      />
      <path d="M17 12v24" strokeDasharray="1 5" />
      <path d="M25 19h11M25 25h11M25 31h7" />
    </svg>
  );
}
