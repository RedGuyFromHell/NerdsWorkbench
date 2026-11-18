export function VoucherIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
    >
      <rect x="4" y="12" width="40" height="24" rx="3" />
      <path d="M16 12v24" strokeDasharray="4 3" />
    </svg>
  );
}
