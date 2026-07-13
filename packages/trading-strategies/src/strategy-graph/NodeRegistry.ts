import type {StringValue} from 'ms';
import {ms} from 'ms';
import {z} from 'zod';
import {CandleBatcher, OrderSide, OrderType} from '@typedtrader/exchange';
import type {BatchedCandle, MarketDataSource, OneMinuteBatchedCandle, TradingPair} from '@typedtrader/exchange';
import {EMA, RSI, SMA} from 'trading-signals';
import {AllAvailableAmount} from '../trader/index.js';
import type {OrderAdvice} from '../trader/index.js';

const ONE_MINUTE_IN_MS = 60_000;

/** A duration in `ms` syntax (`"1m"`, `"5m"`, `"1d"`), no smaller than one candle (`"1m"`). */
const timeframeString = z.string().refine(value => {
  const millis = ms(value as StringValue);
  return typeof millis === 'number' && Number.isFinite(millis) && millis >= ONE_MINUTE_IN_MS;
}, 'Must be a duration of at least "1m" in ms syntax, e.g. "1m", "5m", "1d"');

/**
 * The kind of value that travels along a connection. The editor uses this to make
 * mismatched connections impossible (a Scratch-style "wrong blocks don't snap" guarantee),
 * and the interpreter validates it again when a graph is loaded from JSON.
 */
export type PortValueKind = 'candle' | 'number' | 'trigger';

export interface NodePortDefinition {
  name: string;
  kind: PortValueKind;
  label: string;
}

/**
 * What a node sees on one of its input ports during a tick. `value` is the latest value the
 * connected output ever emitted (its "held" value); `isFresh` marks whether it was emitted
 * during the current tick. Holding stale values is what makes mixed timeframes safe: a 5m
 * indicator keeps its last *closed* bar's value between batch closes instead of leaking
 * mid-bar data.
 */
export interface NodeInputState {
  value: unknown;
  isFresh: boolean;
}

export interface NodeTickContext {
  candle: OneMinuteBatchedCandle;
}

export interface NodeEvaluation {
  /** Values emitted this tick, keyed by output port name. Omitted ports emit nothing. */
  outputs?: Record<string, unknown>;
  /** Set only by sink nodes when their trigger fired. */
  advice?: OrderAdvice;
}

/** Passed to an evaluator's `init` hook when the strategy is attached to a session. */
export interface NodeInitContext {
  market: Pick<MarketDataSource, 'getRecentCandles'>;
  pair: TradingPair;
}

export interface NodeEvaluator {
  /**
   * One-time async setup before the first tick — the place to load external datasets
   * (news archives, on-chain snapshots) so `evaluate` can stay a deterministic lookup.
   */
  init?(context: NodeInitContext): void | Promise<void>;
  evaluate(
    inputs: Record<string, NodeInputState | undefined>,
    context: NodeTickContext
  ): NodeEvaluation | Promise<NodeEvaluation>;
}

export interface NodeTypeDefinition {
  type: string;
  label: string;
  description: string;
  category: 'source' | 'transform' | 'indicator' | 'logic' | 'sink';
  configSchema: z.ZodType;
  inputs: NodePortDefinition[];
  outputs: NodePortDefinition[];
  /** `config` must already be parsed by `configSchema`. */
  createEvaluator(config: unknown): NodeEvaluator;
}

const CandleSourceConfigSchema = z.object({});

const candleSourceDefinition: NodeTypeDefinition = {
  category: 'source',
  configSchema: CandleSourceConfigSchema,
  createEvaluator: () => ({
    evaluate: (_inputs, context) => ({outputs: {out: context.candle}}),
  }),
  description: 'Emits the incoming 1-minute candle on every tick. Every graph starts here.',
  inputs: [],
  label: 'Candles',
  outputs: [{kind: 'candle', label: 'Candle (1m)', name: 'out'}],
  type: 'source:candle',
};

export const BatcherConfigSchema = z.object({
  /** Bar size in `ms` syntax (e.g. "1m", "5m", "1d"). */
  timeframe: timeframeString.default('5m'),
});

const batcherDefinition: NodeTypeDefinition = {
  category: 'transform',
  configSchema: BatcherConfigSchema,
  createEvaluator: config => {
    const {timeframe} = config as z.infer<typeof BatcherConfigSchema>;
    const batcher = new CandleBatcher(ms(timeframe as StringValue));
    return {
      evaluate: inputs => {
        const input = inputs['in'];
        if (!input?.isFresh) {
          return {};
        }
        const batched = batcher.addToBatch(input.value as BatchedCandle);
        return batched ? {outputs: {out: batched}} : {};
      },
    };
  },
  description:
    'Rolls 1-minute candles up to a larger timeframe. Emits only when a bar closes, so downstream nodes never see mid-bar values.',
  inputs: [{kind: 'candle', label: 'Candle', name: 'in'}],
  label: 'Candle Batcher',
  outputs: [{kind: 'candle', label: 'Batched candle', name: 'out'}],
  type: 'batcher',
};

export const FieldConfigSchema = z.object({
  field: z.enum(['open', 'high', 'low', 'close', 'volume', 'medianPrice']).default('close'),
});

const fieldDefinition: NodeTypeDefinition = {
  category: 'transform',
  configSchema: FieldConfigSchema,
  createEvaluator: config => {
    const {field} = config as z.infer<typeof FieldConfigSchema>;
    return {
      evaluate: inputs => {
        const input = inputs['in'];
        if (!input?.isFresh) {
          return {};
        }
        const candle = input.value as BatchedCandle;
        return {outputs: {out: candle[field].toNumber()}};
      },
    };
  },
  description: 'Extracts a numeric field (like the close price) from a candle.',
  inputs: [{kind: 'candle', label: 'Candle', name: 'in'}],
  label: 'Candle Field',
  outputs: [{kind: 'number', label: 'Value', name: 'out'}],
  type: 'field',
};

/** The slice of the `trading-signals` indicator contract the indicator node relies on. */
interface NumericIndicator {
  isStable: boolean;
  add(value: number): unknown;
  getResultOrThrow(): number;
}

const INDICATOR_FACTORIES = {
  EMA: (period: number) => new EMA(period),
  RSI: (period: number) => new RSI(period),
  SMA: (period: number) => new SMA(period),
} satisfies Record<string, (period: number) => NumericIndicator>;

export type GraphIndicatorName = keyof typeof INDICATOR_FACTORIES;

export const IndicatorConfigSchema = z.object({
  indicator: z.enum(['SMA', 'EMA', 'RSI']).default('SMA'),
  period: z.number().int().positive().default(10),
});

const indicatorDefinition: NodeTypeDefinition = {
  category: 'indicator',
  configSchema: IndicatorConfigSchema,
  createEvaluator: config => {
    const {indicator, period} = config as z.infer<typeof IndicatorConfigSchema>;
    const instance = INDICATOR_FACTORIES[indicator](period);
    return {
      evaluate: inputs => {
        const input = inputs['in'];
        if (!input?.isFresh) {
          return {};
        }
        instance.add(input.value as number);
        // Emit only once warmed up — downstream nodes stay silent instead of acting on garbage.
        return instance.isStable ? {outputs: {out: instance.getResultOrThrow()}} : {};
      },
    };
  },
  description: 'Feeds incoming values into a technical indicator. Stays silent until the indicator is warmed up.',
  inputs: [{kind: 'number', label: 'Value', name: 'in'}],
  label: 'Indicator',
  outputs: [{kind: 'number', label: 'Result', name: 'out'}],
  type: 'indicator',
};

const COMPARE_OPERATORS = {
  eq: (a: number, b: number) => a === b,
  gt: (a: number, b: number) => a > b,
  gte: (a: number, b: number) => a >= b,
  lt: (a: number, b: number) => a < b,
  lte: (a: number, b: number) => a <= b,
} satisfies Record<string, (a: number, b: number) => boolean>;

export const IfConfigSchema = z.object({
  operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq']).default('gt'),
  /**
   * `onChange` fires only on the tick where the comparison flips (edge detection — this is
   * what turns "fast > slow" into a *crossover*). `always` fires on every evaluated tick.
   */
  trigger: z.enum(['onChange', 'always']).default('onChange'),
});

const ifDefinition: NodeTypeDefinition = {
  category: 'logic',
  configSchema: IfConfigSchema,
  createEvaluator: config => {
    const {operator, trigger} = config as z.infer<typeof IfConfigSchema>;
    const compare = COMPARE_OPERATORS[operator];
    let previousOutcome: boolean | undefined = undefined;
    return {
      evaluate: inputs => {
        const a = inputs['a'];
        const b = inputs['b'];
        // Evaluate only when at least one side advanced this tick — otherwise nothing changed.
        if (!a?.isFresh && !b?.isFresh) {
          return {};
        }
        if (a?.value === undefined || b?.value === undefined) {
          return {};
        }
        const outcome = compare(a.value as number, b.value as number);
        if (trigger === 'onChange') {
          const wasOutcome = previousOutcome;
          previousOutcome = outcome;
          if (wasOutcome === undefined || wasOutcome === outcome) {
            return {};
          }
        }
        return {outputs: outcome ? {true: true} : {false: true}};
      },
    };
  },
  description:
    'Compares two values and fires its true/false branch. "On change" fires only when the outcome flips — a crossover.',
  inputs: [
    {kind: 'number', label: 'A', name: 'a'},
    {kind: 'number', label: 'B', name: 'b'},
  ],
  label: 'If',
  outputs: [
    {kind: 'trigger', label: 'True', name: 'true'},
    {kind: 'trigger', label: 'False', name: 'false'},
  ],
  type: 'if',
};

export const AdviceConfigSchema = z
  .object({
    amount: z
      .union([z.literal(AllAvailableAmount), z.string().regex(/^\d+(\.\d+)?$/, 'Must be a numeric amount')])
      .default(AllAvailableAmount),
    amountIn: z.enum(['base', 'counter']).default('counter'),
    reason: z.string().optional(),
    side: z.enum(['BUY', 'SELL']).default('BUY'),
  })
  .refine(config => !(config.side === 'BUY' && config.amountIn === 'base' && config.amount === AllAvailableAmount), {
    message: 'A BUY sized in base cannot use the full available amount — set an explicit amount or size it in counter',
  });

const adviceDefinition: NodeTypeDefinition = {
  category: 'sink',
  configSchema: AdviceConfigSchema,
  createEvaluator: config => {
    const {amount, amountIn, reason, side} = config as z.infer<typeof AdviceConfigSchema>;
    const buildAdvice = (): OrderAdvice => {
      if (side === 'SELL') {
        return {amount, amountIn, reason, side: OrderSide.SELL, type: OrderType.MARKET};
      }
      if (amountIn === 'counter') {
        return {amount, amountIn, reason, side: OrderSide.BUY, type: OrderType.MARKET};
      }
      if (amount === AllAvailableAmount) {
        // Unreachable: the config schema refinement rejects this combination.
        throw new Error('A BUY sized in base requires an explicit amount');
      }
      return {amount, amountIn, reason, side: OrderSide.BUY, type: OrderType.MARKET};
    };
    return {
      evaluate: inputs => {
        const when = inputs['when'];
        if (!when?.isFresh || when.value !== true) {
          return {};
        }
        return {advice: buildAdvice()};
      },
    };
  },
  description: 'Emits a market order advice when its trigger fires.',
  inputs: [{kind: 'trigger', label: 'When', name: 'when'}],
  label: 'Order Advice',
  outputs: [],
  type: 'advice',
};

const BUILT_IN_NODE_TYPES: readonly NodeTypeDefinition[] = [
  candleSourceDefinition,
  batcherDefinition,
  fieldDefinition,
  indicatorDefinition,
  ifDefinition,
  adviceDefinition,
];

const registry = new Map(BUILT_IN_NODE_TYPES.map(definition => [definition.type, definition]));

const VALID_PORT_KINDS: ReadonlySet<string> = new Set(['candle', 'number', 'trigger']);

/**
 * The extension point for third-party building blocks (news signals, on-chain data,
 * custom math): register a definition once at startup and it becomes available to every
 * graph and appears in the visual builder's palette — no engine or UI changes needed.
 *
 * Keep `evaluate` deterministic for a given candle stream: backtests replay graphs in the
 * browser, so a node that queries live external state produces irreproducible results.
 * Load external datasets in the evaluator's `init` hook (or inject them via config) and
 * look them up by candle timestamp during evaluation.
 */
export function registerNodeType(definition: NodeTypeDefinition): void {
  if (!definition.type) {
    throw new Error('Node type must have a non-empty "type" id');
  }
  if (registry.has(definition.type)) {
    throw new Error(`Node type "${definition.type}" is already registered`);
  }
  for (const side of ['inputs', 'outputs'] as const) {
    const seen = new Set<string>();
    for (const port of definition[side]) {
      if (!VALID_PORT_KINDS.has(port.kind)) {
        throw new Error(`Node type "${definition.type}": ${side} port "${port.name}" has unknown kind "${port.kind}"`);
      }
      if (seen.has(port.name)) {
        throw new Error(`Node type "${definition.type}": duplicate ${side} port "${port.name}"`);
      }
      seen.add(port.name);
    }
  }
  registry.set(definition.type, definition);
}

/** All available node types (built-ins plus registered extensions), e.g. for rendering a palette. */
export function getNodeTypes(): NodeTypeDefinition[] {
  return [...registry.values()];
}

export function getNodeTypeDefinition(type: string): NodeTypeDefinition | undefined {
  return registry.get(type);
}
