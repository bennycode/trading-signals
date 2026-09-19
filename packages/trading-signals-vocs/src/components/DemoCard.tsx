import type {ReactNode} from 'react';

interface DemoCardProps {
  name: string;
  description: string;
  children: ReactNode;
}

/**
 * Outer card chrome shared by IndicatorDemo, CalculatorDemo, and UtilityInfoPanel:
 * dark panel with a bordered header (name + description) and a padded content area below.
 */
export function DemoCard({children, description, name}: DemoCardProps) {
  return (
    <div className="demo-card overflow-hidden p-0">
      <div className="border-b demo-divider p-4">
        <h3 className="text-xl font-semibold demo-heading mb-2">{name}</h3>
        <p className="demo-muted text-sm">{description}</p>
      </div>
      <div className="space-y-6 p-6">{children}</div>
    </div>
  );
}
