import {CodeBlock} from './CodeBlock';

export function QuickStart() {
  const installCode = 'npm install trading-signals';
  const usageCode = `import { SMA } from 'trading-signals';

const sma = new SMA(5);

sma.add(81);
sma.add(24);
sma.add(75);
sma.add(21);
sma.add(34);

console.log(sma.getResult()); // 47`;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8">
      <h2 className="text-2xl font-bold text-white mb-4">Quick Start</h2>
      <div className="space-y-4">
        <div>
          <p className="text-slate-400 mb-2">Install the package:</p>
          <CodeBlock code={installCode} language="bash" />
        </div>
        <div>
          <p className="text-slate-400 mb-2">Use it in your code:</p>
          <CodeBlock code={usageCode} language="typescript" />
        </div>
      </div>
    </div>
  );
}
