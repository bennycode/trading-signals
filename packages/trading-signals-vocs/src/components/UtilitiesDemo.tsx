'use client';

import CalculatorDemo from './CalculatorDemo';
import {CodeBlock} from './CodeBlock';
import {DemoCard} from './DemoCard';
import IndicatorDemo from './IndicatorDemo';
import {utilities} from '../indicator-demos/utilities';
import type {UtilityInfoConfig} from '../indicator-demos/utilities/types';

function UtilityInfoPanel({utility}: {utility: UtilityInfoConfig}) {
  return (
    <DemoCard name={utility.name} description={utility.description}>
      {utility.signature && (
        <div>
          <h4 className="text-sm font-semibold demo-text mb-2">Signature</h4>
          <CodeBlock code={utility.signature} size="xs" />
        </div>
      )}
      {utility.details && (
        <div>
          <h4 className="text-sm font-semibold demo-text mb-2">Details</h4>
          <p className="demo-text text-sm leading-relaxed">{utility.details}</p>
        </div>
      )}
      {!utility.signature && !utility.details && (
        <p className="demo-muted text-xs italic">No documentation yet for this utility.</p>
      )}
    </DemoCard>
  );
}

export function UtilitiesDemo() {
  return (
    <div className="not-prose space-y-6">
      {utilities.map(utility => {
        if (utility.kind === 'demo') {
          return <IndicatorDemo key={utility.id} example={utility} />;
        }
        if (utility.kind === 'calculator') {
          return <CalculatorDemo key={utility.id} example={utility} />;
        }
        return <UtilityInfoPanel key={utility.id} utility={utility} />;
      })}
    </div>
  );
}
