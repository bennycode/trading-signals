import CalculatorDemo from '../../components/CalculatorDemo';
import {CodeBlock} from '../../components/CodeBlock';
import {DemoCard} from '../../components/DemoCard';
import IndicatorDemo from '../../components/IndicatorDemo';
import {IndicatorList} from '../../components/IndicatorList';
import {useHashSelection} from '../../hooks/useHashSelection';
import {interactiveUtilities, utilities} from '../../indicator-demos/utilities';
import {otherUtilities} from '../../indicator-demos/utilities/otherUtilities';
import type {UtilityInfoConfig} from '../../indicator-demos/utilities/types';

function UtilityInfoPanel({utility}: {utility: UtilityInfoConfig}) {
  return (
    <DemoCard name={utility.name} description={utility.description}>
      {utility.signature && (
        <div>
          <h4 className="text-sm font-semibold text-slate-300 mb-2">Signature</h4>
          <CodeBlock code={utility.signature} size="xs" />
        </div>
      )}
      {utility.details && (
        <div>
          <h4 className="text-sm font-semibold text-slate-300 mb-2">Details</h4>
          <p className="text-slate-300 text-sm leading-relaxed">{utility.details}</p>
        </div>
      )}
      {!utility.signature && !utility.details && (
        <p className="text-slate-500 text-xs italic">No documentation yet for this utility.</p>
      )}
    </DemoCard>
  );
}

export default function UtilityFunctions() {
  const [selectedUtility, selectUtility] = useHashSelection(utilities, utilities[0].id);

  const activeUtility = utilities.find(util => util.id === selectedUtility) ?? utilities[0];

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <aside className="w-64 shrink-0">
        <div className="sticky top-6 space-y-4">
          <IndicatorList
            title="Utility Functions"
            indicators={interactiveUtilities.map(util => ({
              description: util.description,
              id: util.id,
              name: util.name,
            }))}
            selectedIndicator={selectedUtility}
            onIndicatorChange={selectUtility}
          />
          <IndicatorList
            title="Other Utility Functions"
            indicators={otherUtilities.map(util => ({description: util.description, id: util.id, name: util.name}))}
            selectedIndicator={selectedUtility}
            onIndicatorChange={selectUtility}
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-white mb-4">Utility Functions</h1>
          <p className="text-slate-300 text-lg">
            Mathematical utility functions that support technical analysis calculations. These are the building blocks
            used by many indicators and are also useful for custom analysis.
          </p>
        </div>

        {activeUtility.kind === 'demo' ? (
          <IndicatorDemo example={activeUtility} />
        ) : activeUtility.kind === 'calculator' ? (
          <CalculatorDemo example={activeUtility} />
        ) : (
          <UtilityInfoPanel utility={activeUtility} />
        )}
      </main>
    </div>
  );
}
