interface IndicatorHeaderProps {
  name: string;
  parameters: string;
  requiredInputs: number;
  description: string;
  details?: string;
}

export function IndicatorHeader({name, parameters, requiredInputs, description, details}: IndicatorHeaderProps) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2 select-text">
        {name}({parameters}) / Required Inputs: {requiredInputs}
      </h2>
      <p className="text-slate-300 select-text">{description}</p>
      {details && <p className="text-slate-400 text-sm mt-2 select-text">{details}</p>}
    </div>
  );
}
