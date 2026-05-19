import {useEffect, useState} from 'react';
import CalculatorDemo from '../../components/CalculatorDemo';
import IndicatorDemo from '../../components/IndicatorDemo';
import {IndicatorList} from '../../components/IndicatorList';
import {interactiveUtilities, utilities} from '../../indicator-demos/utilities';
import {otherUtilities} from '../../indicator-demos/utilities/otherUtilities';
import type {UtilityInfoConfig} from '../../indicator-demos/utilities/types';

function UtilityInfoPanel({utility}: {utility: UtilityInfoConfig}) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
      <div className="border-b border-slate-700 p-4">
        <h3 className="text-xl font-semibold text-white mb-2">{utility.name}</h3>
        <p className="text-slate-400 text-sm">{utility.description}</p>
      </div>
      <div className="p-6 space-y-4">
        {utility.signature && (
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-2">Signature</h4>
            <pre className="bg-slate-900 border border-slate-700 rounded p-4 overflow-x-auto text-xs">
              <code className="text-slate-300">{utility.signature}</code>
            </pre>
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
      </div>
    </div>
  );
}

export default function UtilityFunctions() {
  const [selectedUtility, setSelectedUtility] = useState<string>(utilities[0].id);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && utilities.some(util => util.id === hash)) {
      setSelectedUtility(hash);
    }
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash && utilities.some(util => util.id === hash)) {
        setSelectedUtility(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleUtilityChange = (utilityId: string) => {
    setSelectedUtility(utilityId);
    window.location.hash = utilityId;
  };

  const activeUtility = utilities.find(util => util.id === selectedUtility) ?? utilities[0];

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <aside className="w-64 shrink-0">
        <div className="sticky top-6 space-y-4">
          <IndicatorList
            title="Utility Functions"
            indicators={interactiveUtilities.map(util => ({id: util.id, name: util.name, description: util.description}))}
            selectedIndicator={selectedUtility}
            onIndicatorChange={handleUtilityChange}
          />
          <IndicatorList
            title="Other Utility Functions"
            indicators={otherUtilities.map(util => ({id: util.id, name: util.name, description: util.description}))}
            selectedIndicator={selectedUtility}
            onIndicatorChange={handleUtilityChange}
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
