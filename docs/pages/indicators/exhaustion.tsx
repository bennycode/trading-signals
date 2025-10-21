import {TDS} from 'trading-signals';
import IndicatorDemo, {IndicatorExample} from '../../components/IndicatorDemo';

export default function ExhaustionIndicators() {
  const examples: IndicatorExample[] = [
    {
      name: 'Tom DeMark Sequential (TDS)',
      description: 'Identifies potential trend exhaustion and reversal points',
      code: `import { TDS } from 'trading-signals';

const td = new TDS();

// Returns 1 for bullish setup
// Returns -1 for bearish setup
// Returns 0 otherwise
const result = td.add(closePrice);

console.log(result);`,
      inputValues: [50, 49, 48, 47, 46, 45, 44, 43, 42, 41, 40],
      calculate: values => {
        const td = new TDS();
        const allResults: Array<{value: number; result: string | null}> = [];

        for (const value of values) {
          const result = td.add(value);
          allResults.push({
            value,
            result: result !== null ? result.toString() : '0',
          });
        }

        return {
          result: allResults.length > 0 ? allResults[allResults.length - 1].result : null,
          allResults,
        };
      },
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-white mb-4">Exhaustion Indicators</h1>
        <p className="text-slate-300 text-lg">
          Exhaustion indicators help identify when a trend is losing momentum and may be about to reverse. They're
          particularly useful for spotting potential turning points in the market.
        </p>
      </div>

      <div className="bg-green-900/20 border border-green-800/50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-green-400 mb-3">🎯 Tom DeMark Sequential</h2>
        <div className="text-slate-300 space-y-3">
          <p>
            The TD Sequential is a sophisticated indicator developed by Tom DeMark that identifies potential trend
            exhaustion points through a two-phase process:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>
              <strong>Setup Phase:</strong> Counts consecutive closes higher or lower than closes 4 periods ago
            </li>
            <li>
              <strong>Countdown Phase:</strong> Requires 13 closes to complete (not necessarily consecutive)
            </li>
            <li>
              <strong>Bullish Setup (1):</strong> Series of lower closes suggesting potential bottom
            </li>
            <li>
              <strong>Bearish Setup (-1):</strong> Series of higher closes suggesting potential top
            </li>
            <li>
              <strong>No Setup (0):</strong> No significant pattern detected
            </li>
          </ul>
          <p className="text-slate-400 text-sm mt-4">
            Note: A complete TD Sequential setup requires 9 consecutive qualifying closes. The indicator is most
            powerful when combined with other technical analysis tools.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {examples.map((example, idx) => (
          <IndicatorDemo key={idx} example={example} />
        ))}
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h2 className="text-2xl font-semibold text-white mb-4">Using Exhaustion Indicators</h2>
        <div className="space-y-4 text-slate-300">
          <p>
            Exhaustion indicators work best when combined with other forms of analysis. Here are some best practices:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Look for confirmation from volume indicators (like OBV) when a setup completes</li>
            <li>Use momentum indicators (like RSI) to confirm overbought/oversold conditions</li>
            <li>Consider the broader trend context - exhaustion signals are stronger against the prevailing trend</li>
            <li>Wait for price action confirmation before taking positions based solely on exhaustion signals</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
