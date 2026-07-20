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
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
      <div className="border-b border-slate-700 p-4">
        <h3 className="text-xl font-semibold text-white mb-2">{name}</h3>
        <p className="text-slate-400 text-sm">{description}</p>
      </div>
      <div className="space-y-6 p-6">{children}</div>
    </div>
  );
}
