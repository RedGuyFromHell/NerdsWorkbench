interface SectionHeaderProps {
  title: string;
  /** A step number shown before the title, for example 1. */
  number?: number;
}

export function SectionHeader({ title, number }: SectionHeaderProps) {
  return (
    <h2 className="section-header">
      {number === undefined ? null : <span className="section-header__number">{number}</span>}
      {title}
    </h2>
  );
}
