import type { ReactNode } from "react";

export type TagTone = "plain" | "warn" | "good" | "danger";

interface TagProps {
  tone?: TagTone;
  /** What the tag means, shown on hover. The words of the tag itself must make sense alone. */
  title?: string;
  children: ReactNode;
}

/** A small outlined label for a special case: "cost from table", "not paid yet". */
export function Tag({ tone = "plain", title, children }: TagProps) {
  return (
    <span className={`tag tag--${tone}`} title={title}>
      {children}
    </span>
  );
}
