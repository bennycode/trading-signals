import type {CalculatorExample} from '../../components/CalculatorDemo';
import type {IndicatorExample} from '../../components/IndicatorDemo';

export interface UtilityDemoConfig extends IndicatorExample {
  kind: 'demo';
  id: string;
}

export interface UtilityCalculatorConfig extends CalculatorExample {
  kind: 'calculator';
  id: string;
}

export interface UtilityInfoConfig {
  kind: 'info';
  id: string;
  name: string;
  description: string;
  details?: string;
  signature?: string;
}

export type UtilityConfig = UtilityDemoConfig | UtilityCalculatorConfig | UtilityInfoConfig;
