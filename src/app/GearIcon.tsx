// A cog in the retro line style: thick outline, eight square teeth, a round hole in the middle.
export function GearIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d="M9.9 5.1L10.1 2.2L13.9 2.2L14.1 5.1L15.4 5.6L17.6 3.7L20.3 6.4L18.4 8.6L18.9 9.9L21.8 10.1L21.8 13.9L18.9 14.1L18.4 15.4L20.3 17.6L17.6 20.3L15.4 18.4L14.1 18.9L13.9 21.8L10.1 21.8L9.9 18.9L8.6 18.4L6.4 20.3L3.7 17.6L5.6 15.4L5.1 14.1L2.2 13.9L2.2 10.1L5.1 9.9L5.6 8.6L3.7 6.4L6.4 3.7L8.6 5.6z"
        fill="var(--icon-fill, var(--title-yellow))"
      />
      <circle cx="12" cy="12" r="3.2" fill="var(--field)" />
    </svg>
  );
}
