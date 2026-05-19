import {useEffect, useState} from 'react';

export interface CalculatorInputDef {
  label: string;
  defaultValue: string;
}

export interface CalculatorExample {
  name: string;
  description: string;
  inputs: [CalculatorInputDef, CalculatorInputDef];
  outputLabel: string;
  outputSuffix?: string;
  /** Throws an error to be shown in place of the result if inputs are invalid. */
  calculate: (a: number, b: number) => number;
  code: string;
}

function formatResult(value: number): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  // Trim trailing zeros for nicer display.
  return value
    .toFixed(8)
    .replace(/\.?0+$/, '');
}

export default function CalculatorDemo({example}: {example: CalculatorExample}) {
  const [a, setA] = useState(example.inputs[0].defaultValue);
  const [b, setB] = useState(example.inputs[1].defaultValue);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const parsedA = parseFloat(a);
    const parsedB = parseFloat(b);

    if (Number.isNaN(parsedA) || Number.isNaN(parsedB)) {
      setError('Enter valid numbers');
      setResult('');
      return;
    }

    try {
      const value = example.calculate(parsedA, parsedB);
      setResult(formatResult(value));
      setError(null);
    } catch (caught) {
      setError((caught as Error).message);
      setResult('');
    }
  }, [a, b, example]);

  const handleReset = () => {
    setA(example.inputs[0].defaultValue);
    setB(example.inputs[1].defaultValue);
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
      <div className="border-b border-slate-700 p-4">
        <h3 className="text-xl font-semibold text-white mb-2">{example.name}</h3>
        <p className="text-slate-400 text-sm">{example.description}</p>
      </div>

      <div className="space-y-6 p-6">
        {/* Interactive Demo */}
        <div>
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Interactive Demo</h4>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">{example.inputs[0].label}</label>
              <input
                type="number"
                value={a}
                onChange={event => setA(event.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">{example.inputs[1].label}</label>
              <input
                type="number"
                value={b}
                onChange={event => setB(event.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded p-4 mb-4">
            <div className="text-xs text-slate-400 mb-1">{example.outputLabel}:</div>
            {error ? (
              <div className="text-lg font-mono text-red-400">{error}</div>
            ) : (
              <div className="text-2xl font-mono font-bold text-green-400">
                {result}
                {example.outputSuffix && <span className="text-slate-400 text-base ml-1">{example.outputSuffix}</span>}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 bg-slate-700 text-white rounded text-sm hover:bg-slate-600 transition-colors">
            Reset
          </button>
        </div>

        {/* Code Example */}
        <div>
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Code Example</h4>
          <pre className="bg-slate-900 border border-slate-700 rounded p-4 overflow-x-auto text-xs">
            <code className="text-slate-300">{example.code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
