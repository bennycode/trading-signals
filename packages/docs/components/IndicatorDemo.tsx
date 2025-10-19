import {useState, useEffect} from 'react';

export interface IndicatorExample {
  name: string;
  description: string;
  code: string;
  inputValues: number[];
  calculate: (values: number[]) => {result: string | null; allResults: Array<{value: number; result: string | null}>};
}

export default function IndicatorDemo({example}: {example: IndicatorExample}) {
  const [customInput, setCustomInput] = useState('');
  const [values, setValues] = useState<number[]>(example.inputValues);
  const [currentResult, setCurrentResult] = useState<string | null>(null);
  const [allResults, setAllResults] = useState<Array<{value: number; result: string | null}>>([]);

  useEffect(() => {
    const {result, allResults} = example.calculate(values);
    setCurrentResult(result);
    setAllResults(allResults);
  }, [values, example]);

  const handleAddValue = () => {
    const newValue = parseFloat(customInput);
    if (!isNaN(newValue)) {
      setValues([...values, newValue]);
      setCustomInput('');
    }
  };

  const handleReset = () => {
    setValues(example.inputValues);
    setCustomInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddValue();
    }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
      <div className="border-b border-slate-700 p-4">
        <h3 className="text-xl font-semibold text-white mb-2">{example.name}</h3>
        <p className="text-slate-400 text-sm">{example.description}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 p-6">
        {/* Left: Code Example */}
        <div>
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Code Example</h4>
          <pre className="bg-slate-900 border border-slate-700 rounded p-4 overflow-x-auto text-xs">
            <code className="text-slate-300">{example.code}</code>
          </pre>
        </div>

        {/* Right: Interactive Demo */}
        <div>
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Interactive Demo</h4>

          {/* Input Controls */}
          <div className="flex gap-2 mb-4">
            <input
              type="number"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter a value"
              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleAddValue}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors">
              Add
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-slate-700 text-white rounded text-sm hover:bg-slate-600 transition-colors">
              Reset
            </button>
          </div>

          {/* Current Result */}
          <div className="bg-slate-900 border border-slate-700 rounded p-4 mb-4">
            <div className="text-xs text-slate-400 mb-1">Current Result:</div>
            <div className="text-2xl font-mono font-bold text-green-400">{currentResult ?? 'Not enough data'}</div>
          </div>

          {/* Value History */}
          <div className="bg-slate-900 border border-slate-700 rounded p-4 max-h-60 overflow-y-auto">
            <div className="text-xs text-slate-400 mb-2">Values & Results ({allResults.length} total):</div>
            <div className="space-y-1">
              {allResults.map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center text-sm py-1 border-b border-slate-800 last:border-0">
                  <span className="text-slate-300 font-mono">
                    #{idx + 1}: {item.value}
                  </span>
                  <span className={`font-mono ${item.result ? 'text-green-400' : 'text-slate-600'}`}>
                    {item.result ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
