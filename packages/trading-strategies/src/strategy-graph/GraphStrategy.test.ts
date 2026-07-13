import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {AlpacaBrokerMock, CandleBatcher, OrderSide, TradingPair} from '@typedtrader/exchange';
import type {Candle, OneMinuteBatchedCandle} from '@typedtrader/exchange';
import {OrderType} from '@typedtrader/exchange';
import {BacktestExecutor} from '../backtest/BacktestExecutor.js';
import {SmaCrossoverStrategy} from '../strategy-sma-crossover/SmaCrossoverStrategy.js';
import {AllAvailableAmount} from '../trader/index.js';
import type {OrderAdvice, TradingSessionState, TradingSessionStrategy} from '../trader/index.js';
import {z} from 'zod';
import {GraphStrategy} from './GraphStrategy.js';
import type {StrategyGraphInput} from './GraphSchema.js';
import {getNodeTypes, registerNodeType} from './NodeRegistry.js';
import type {NodeTypeDefinition} from './NodeRegistry.js';
import {createSmaCrossoverGraph} from './templates.js';

const pair = new TradingPair('AAPL', 'USD');

const mockState: TradingSessionState = {
  baseBalance: new Big(0),
  counterBalance: new Big(1000),
  feeRates: {
    [OrderType.LIMIT]: new Big('0.001'),
    [OrderType.MARKET]: new Big('0.002'),
  },
  tradingRules: {
    base_increment: '0.01',
    base_max_size: '10000',
    base_min_size: '0.01',
    counter_increment: '0.01',
    counter_min_size: '1',
    pair,
  },
};

const ONE_MINUTE_IN_MS = 60_000;
const START_TIME_IN_MS = 1735689600000;

function makeExchangeCandle(close: number, index: number): Candle {
  const closeStr = String(close);
  return {
    base: 'AAPL',
    close: closeStr,
    counter: 'USD',
    high: String(close + 1),
    low: String(close - 1),
    open: closeStr,
    openTimeInISO: new Date(START_TIME_IN_MS + index * ONE_MINUTE_IN_MS).toISOString(),
    openTimeInMillis: START_TIME_IN_MS + index * ONE_MINUTE_IN_MS,
    sizeInMillis: ONE_MINUTE_IN_MS,
    volume: '1000',
  };
}

function makeCandle(close: number, index: number): OneMinuteBatchedCandle {
  return CandleBatcher.createOneMinuteBatchedCandle([makeExchangeCandle(close, index)]);
}

async function feed(strategy: TradingSessionStrategy, prices: number[]): Promise<OrderAdvice[]> {
  const advices: OrderAdvice[] = [];
  for (const [index, price] of prices.entries()) {
    const advice = await strategy.onCandle(makeCandle(price, index), mockState);
    if (advice) {
      advices.push(advice);
    }
  }
  return advices;
}

/** Comparable essence of an advice — `reason` texts legitimately differ between the two strategies. */
function essence(advice: OrderAdvice) {
  return {amount: advice.amount, amountIn: advice.amountIn, side: advice.side, type: advice.type};
}

/** A long, wavy price series that produces many crossovers in both directions. */
function wavyPrices(length: number): number[] {
  return Array.from({length}, (_, index) => 100 + 10 * Math.sin(index / 5) + index * 0.05);
}

describe('GraphStrategy', () => {
  describe('validation', () => {
    const minimalNodes: StrategyGraphInput['nodes'] = {
      buy: {config: {side: 'BUY'}, type: 'advice'},
      candles: {type: 'source:candle'},
      close: {type: 'field'},
      crossover: {type: 'if'},
      fast: {config: {period: 2}, type: 'indicator'},
      slow: {config: {period: 3}, type: 'indicator'},
    };

    const minimalConnections: StrategyGraphInput['connections'] = [
      {from: {node: 'candles'}, to: {node: 'close'}},
      {from: {node: 'close'}, to: {node: 'fast'}},
      {from: {node: 'close'}, to: {node: 'slow'}},
      {from: {node: 'fast'}, to: {node: 'crossover', port: 'a'}},
      {from: {node: 'slow'}, to: {node: 'crossover', port: 'b'}},
      {from: {node: 'crossover', port: 'true'}, to: {node: 'buy', port: 'when'}},
    ];

    it('accepts a minimal valid graph', () => {
      expect(() => new GraphStrategy({connections: minimalConnections, nodes: minimalNodes, version: 1})).not.toThrow();
    });

    it('rejects an unknown node type', () => {
      expect(
        () =>
          new GraphStrategy({
            connections: [],
            nodes: {mystery: {type: 'quantum-oracle'}},
            version: 1,
          })
      ).toThrowError(/unknown node type "quantum-oracle"/);
    });

    it('rejects a type mismatch between connected ports', () => {
      const connections = [...minimalConnections, {from: {node: 'candles'}, to: {node: 'crossover', port: 'a'}}];
      expect(() => new GraphStrategy({connections, nodes: minimalNodes, version: 1})).toThrowError(
        /more than one incoming connection|Type mismatch/
      );
      // Directly: candle output into a number input
      expect(
        () =>
          new GraphStrategy({
            connections: [
              {from: {node: 'candles'}, to: {node: 'fast'}},
              ...minimalConnections.filter(connection => connection.to.node !== 'fast'),
            ],
            nodes: minimalNodes,
            version: 1,
          })
      ).toThrowError(/Type mismatch: "candles:out" emits candle but "fast:in" expects number/);
    });

    it('rejects an unconnected input port', () => {
      const connections = minimalConnections.filter(connection => connection.to.node !== 'buy');
      expect(() => new GraphStrategy({connections, nodes: minimalNodes, version: 1})).toThrowError(
        /Node "buy" \(Order Advice\): input port "when" is not connected/
      );
    });

    it('rejects a graph without an advice node', () => {
      const nodes = {...minimalNodes};
      delete (nodes as Record<string, unknown>).buy;
      const connections = minimalConnections.filter(connection => connection.to.node !== 'buy');
      expect(() => new GraphStrategy({connections, nodes, version: 1})).toThrowError(/no sink node/);
    });

    it('rejects an invalid node config with a node-addressable error', () => {
      const nodes: StrategyGraphInput['nodes'] = {
        ...minimalNodes,
        fast: {config: {period: -5}, type: 'indicator'},
      };
      expect(() => new GraphStrategy({connections: minimalConnections, nodes, version: 1})).toThrowError(
        /Node "fast": invalid config/
      );
    });

    it('rejects a BUY advice sized in base with the full available amount', () => {
      const nodes: StrategyGraphInput['nodes'] = {
        ...minimalNodes,
        buy: {config: {amount: 'ALL_AVAILABLE_AMOUNT', amountIn: 'base', side: 'BUY'}, type: 'advice'},
      };
      // Refinement issues have an empty path — the message must not degrade to "invalid config — : …".
      expect(() => new GraphStrategy({connections: minimalConnections, nodes, version: 1})).toThrowError(
        /Node "buy": invalid config — A BUY sized in base/
      );
    });

    it('evaluates equivalent graphs identically regardless of JSON key order', async () => {
      /*
       * Two advice nodes race on the same trigger tick — "first advice wins" must not
       * depend on how the JSON happens to order its keys or connections.
       */
      const nodes: StrategyGraphInput['nodes'] = {
        adviceA: {config: {amountIn: 'counter', reason: 'A', side: 'BUY'}, type: 'advice'},
        adviceB: {config: {amountIn: 'counter', reason: 'B', side: 'BUY'}, type: 'advice'},
        candles: {type: 'source:candle'},
        close: {type: 'field'},
        condition: {config: {operator: 'gt', trigger: 'always'}, type: 'if'},
        sma: {config: {period: 2}, type: 'indicator'},
      };
      const connections: StrategyGraphInput['connections'] = [
        {from: {node: 'candles'}, to: {node: 'close'}},
        {from: {node: 'close'}, to: {node: 'sma'}},
        {from: {node: 'close'}, to: {node: 'condition', port: 'a'}},
        {from: {node: 'sma'}, to: {node: 'condition', port: 'b'}},
        {from: {node: 'condition', port: 'true'}, to: {node: 'adviceA', port: 'when'}},
        {from: {node: 'condition', port: 'true'}, to: {node: 'adviceB', port: 'when'}},
      ];
      const reversed: StrategyGraphInput = {
        connections: [...connections].reverse(),
        nodes: Object.fromEntries(Object.entries(nodes).reverse()),
        version: 1,
      };

      const prices = [10, 11, 12, 13];
      const [advices, reversedAdvices] = await Promise.all([
        feed(new GraphStrategy({connections, nodes, version: 1}), prices),
        feed(new GraphStrategy(reversed), prices),
      ]);

      expect(advices.length).toBeGreaterThan(0);
      expect(advices.map(advice => advice.reason)).toEqual(reversedAdvices.map(advice => advice.reason));
      expect(advices.every(advice => advice.reason === 'A')).toBe(true);
    });

    it('rejects a cyclic graph', () => {
      // Two if-nodes feeding each other's inputs can never be evaluated.
      const nodes: StrategyGraphInput['nodes'] = {
        ...minimalNodes,
        loopA: {type: 'indicator'},
        loopB: {type: 'indicator'},
      };
      const connections: StrategyGraphInput['connections'] = [
        ...minimalConnections,
        {from: {node: 'loopA'}, to: {node: 'loopB'}},
        {from: {node: 'loopB'}, to: {node: 'loopA'}},
      ];
      expect(() => new GraphStrategy({connections, nodes, version: 1})).toThrowError(/cycle/);
    });
  });

  describe('equivalence with SmaCrossoverStrategy', () => {
    const configurations = [
      {fastPeriod: 2, fastTimeframe: '1m', slowPeriod: 3, slowTimeframe: '1m'},
      {fastPeriod: 2, fastTimeframe: '1m', slowPeriod: 2, slowTimeframe: '2m'},
      {fastPeriod: 5, fastTimeframe: '1m', slowPeriod: 4, slowTimeframe: '3m'},
    ] as const;

    it.each(configurations)('produces identical advice to the hand-written strategy (%o)', async configuration => {
      const prices = wavyPrices(240);
      const handWritten = new SmaCrossoverStrategy(configuration);
      const graph = new GraphStrategy(createSmaCrossoverGraph(configuration));

      const [handWrittenAdvices, graphAdvices] = await Promise.all([feed(handWritten, prices), feed(graph, prices)]);

      expect(graphAdvices.length).toBeGreaterThan(2);
      expect(graphAdvices.map(essence)).toEqual(handWrittenAdvices.map(essence));
    });

    it('produces an identical backtest result to the hand-written strategy', async () => {
      const candles = wavyPrices(240).map(makeExchangeCandle);
      const tradingPair = new TradingPair('AAPL', 'USD');

      const createBroker = () =>
        new AlpacaBrokerMock({
          balances: new Map([
            ['AAPL', {available: new Big(0), hold: new Big(0)}],
            ['USD', {available: new Big(10000), hold: new Big(0)}],
          ]),
        });

      const configuration = {fastPeriod: 5, fastTimeframe: '1m', slowPeriod: 10, slowTimeframe: '2m'};
      const [handWritten, graph] = await Promise.all([
        new BacktestExecutor({
          broker: createBroker(),
          candles,
          strategy: new SmaCrossoverStrategy(configuration),
          tradingPair,
        }).execute(),
        new BacktestExecutor({
          broker: createBroker(),
          candles,
          strategy: new GraphStrategy(createSmaCrossoverGraph(configuration)),
          tradingPair,
        }).execute(),
      ]);

      expect(graph.trades.length).toBeGreaterThan(0);
      expect(graph.trades.length).toBe(handWritten.trades.length);
      expect(graph.finalBaseBalance.toFixed(8)).toBe(handWritten.finalBaseBalance.toFixed(8));
      expect(graph.finalCounterBalance.toFixed(8)).toBe(handWritten.finalCounterBalance.toFixed(8));
      expect(graph.profitOrLoss.toFixed(8)).toBe(handWritten.profitOrLoss.toFixed(8));
    });
  });

  describe('trigger semantics', () => {
    function thresholdGraph(trigger: 'onChange' | 'always'): StrategyGraphInput {
      // Buys whenever the close is above its SMA2 — a level condition, not a crossover.
      return {
        connections: [
          {from: {node: 'candles'}, to: {node: 'close'}},
          {from: {node: 'close'}, to: {node: 'sma'}},
          {from: {node: 'close'}, to: {node: 'condition', port: 'a'}},
          {from: {node: 'sma'}, to: {node: 'condition', port: 'b'}},
          {from: {node: 'condition', port: 'true'}, to: {node: 'buy', port: 'when'}},
        ],
        nodes: {
          buy: {config: {amountIn: 'counter', side: 'BUY'}, type: 'advice'},
          candles: {type: 'source:candle'},
          close: {type: 'field'},
          condition: {config: {operator: 'gt', trigger}, type: 'if'},
          sma: {config: {indicator: 'SMA', period: 2}, type: 'indicator'},
        },
        version: 1,
      };
    }

    // Close > SMA2 from index 2 onward (rising), so the condition holds on many consecutive candles.
    const risingPrices = [10, 11, 12, 13, 14, 15];

    it('fires once at the flip with trigger "onChange"', async () => {
      // The first evaluation only records the state; a BUY needs false → true, so dip first.
      const advices = await feed(new GraphStrategy(thresholdGraph('onChange')), [10, 9, 8, 9, 12, 13, 14]);
      expect(advices.map(advice => advice.side)).toEqual([OrderSide.BUY]);
    });

    it('fires on every matching candle with trigger "always"', async () => {
      const advices = await feed(new GraphStrategy(thresholdGraph('always')), risingPrices);
      expect(advices.length).toBeGreaterThan(1);
      expect(advices.every(advice => advice.side === OrderSide.BUY)).toBe(true);
    });
  });

  describe('advice payload', () => {
    it('uses the configured amount and amountIn', async () => {
      const graph: StrategyGraphInput = {
        connections: [
          {from: {node: 'candles'}, to: {node: 'close'}},
          {from: {node: 'close'}, to: {node: 'sma'}},
          {from: {node: 'close'}, to: {node: 'condition', port: 'a'}},
          {from: {node: 'sma'}, to: {node: 'condition', port: 'b'}},
          {from: {node: 'condition', port: 'true'}, to: {node: 'buy', port: 'when'}},
        ],
        nodes: {
          buy: {config: {amount: '250', amountIn: 'counter', reason: 'breakout', side: 'BUY'}, type: 'advice'},
          candles: {type: 'source:candle'},
          close: {type: 'field'},
          condition: {config: {operator: 'gt', trigger: 'always'}, type: 'if'},
          sma: {config: {period: 2}, type: 'indicator'},
        },
        version: 1,
      };
      const [buy] = await feed(new GraphStrategy(graph), [10, 11, 12]);
      expect(buy).toEqual({
        amount: '250',
        amountIn: 'counter',
        reason: 'breakout',
        side: OrderSide.BUY,
        type: OrderType.MARKET,
      });
    });

    it('defaults to the full available amount', async () => {
      const graph = createSmaCrossoverGraph({fastPeriod: 2, fastTimeframe: '1m', slowPeriod: 3, slowTimeframe: '1m'});
      const advices = await feed(new GraphStrategy(graph), [10, 9, 8, 7, 6, 7, 9, 12, 15, 12, 9, 6]);
      expect(advices.map(advice => advice.side)).toEqual([OrderSide.BUY, OrderSide.SELL]);
      expect(advices[0].amount).toBe(AllAvailableAmount);
    });
  });

  describe('custom node types', () => {
    function makeDefinition(overrides: Partial<NodeTypeDefinition>): NodeTypeDefinition {
      return {
        category: 'indicator',
        configSchema: z.object({}),
        createEvaluator: () => ({evaluate: () => ({})}),
        description: 'Test node',
        inputs: [{kind: 'candle', label: 'Candle', name: 'in'}],
        label: 'Test Node',
        outputs: [{kind: 'number', label: 'Value', name: 'out'}],
        type: 'test:node',
        ...overrides,
      };
    }

    it('runs a registered node with an async evaluator inside a graph', async () => {
      let initialized = false;
      registerNodeType(
        makeDefinition({
          createEvaluator: () => {
            let count = 0;
            return {
              // Simulates an external-data node: async lookup, fires on every 3rd candle.
              evaluate: async inputs => {
                if (!inputs['in']?.isFresh) {
                  return {};
                }
                count += 1;
                await Promise.resolve();
                return count % 3 === 0 ? {outputs: {fire: true}} : {};
              },
              init: async () => {
                await Promise.resolve();
                initialized = true;
              },
            };
          },
          outputs: [{kind: 'trigger', label: 'Fire', name: 'fire'}],
          type: 'test:async-pulse',
        })
      );

      const strategy = new GraphStrategy({
        connections: [
          {from: {node: 'candles'}, to: {node: 'pulse'}},
          {from: {node: 'pulse', port: 'fire'}, to: {node: 'buy', port: 'when'}},
        ],
        nodes: {
          buy: {config: {amountIn: 'counter', side: 'BUY'}, type: 'advice'},
          candles: {type: 'source:candle'},
          pulse: {type: 'test:async-pulse'},
        },
        version: 1,
      });

      await strategy.init({getRecentCandles: async () => []}, pair);
      expect(initialized).toBe(true);

      const advices = await feed(strategy, [10, 11, 12, 13, 14, 15]);
      expect(advices, 'fires on candle 3 and 6').toHaveLength(2);
      expect(advices.every(advice => advice.side === OrderSide.BUY)).toBe(true);
    });

    it('appears in the node type list once registered', () => {
      registerNodeType(makeDefinition({type: 'test:listed'}));
      expect(getNodeTypes().map(definition => definition.type)).toContain('test:listed');
    });

    it('rejects a duplicate type id', () => {
      registerNodeType(makeDefinition({type: 'test:duplicate'}));
      expect(() => registerNodeType(makeDefinition({type: 'test:duplicate'}))).toThrowError(/already registered/);
      expect(() => registerNodeType(makeDefinition({type: 'batcher'}))).toThrowError(/already registered/);
    });

    it('rejects an unknown port kind', () => {
      const definition = makeDefinition({
        outputs: [{kind: 'boolean' as never, label: 'Value', name: 'out'}],
        type: 'test:bad-kind',
      });
      expect(() => registerNodeType(definition)).toThrowError(/unknown kind "boolean"/);
    });

    it('rejects duplicate port names on the same side', () => {
      const definition = makeDefinition({
        outputs: [
          {kind: 'number', label: 'A', name: 'out'},
          {kind: 'number', label: 'B', name: 'out'},
        ],
        type: 'test:dup-port',
      });
      expect(() => registerNodeType(definition)).toThrowError(/duplicate outputs port "out"/);
    });
  });
});
