import type {ReactNode} from 'react';

interface CollapsibleCardProps {
  title: string;
  children: ReactNode;
}

/** Native `<details>` card, collapsed by default to keep the long demo pages scannable. */
export function CollapsibleCard({children, title}: CollapsibleCardProps) {
  return (
    <details className="demo-card">
      <summary className="text-lg font-semibold demo-heading cursor-pointer select-none">{title}</summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
