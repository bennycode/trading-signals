import type {StrategyGraphInput} from './GraphSchema.js';

export interface SmaCrossoverGraphOptions {
  fastPeriod?: number;
  fastTimeframe?: string;
  slowPeriod?: number;
  slowTimeframe?: string;
}

/**
 * The classic dual-SMA crossover expressed as a graph — the same logic as
 * `SmaCrossoverStrategy`, but built from generic nodes. Serves as the editor's starter
 * template and as the fixture proving the graph interpreter matches a hand-written strategy.
 */
export function createSmaCrossoverGraph(options: SmaCrossoverGraphOptions = {}): StrategyGraphInput {
  const {fastPeriod = 10, fastTimeframe = '1m', slowPeriod = 20, slowTimeframe = '5m'} = options;

  return {
    connections: [
      {from: {node: 'candles', port: 'out'}, to: {node: 'fastBatcher', port: 'in'}},
      {from: {node: 'candles', port: 'out'}, to: {node: 'slowBatcher', port: 'in'}},
      {from: {node: 'fastBatcher', port: 'out'}, to: {node: 'fastClose', port: 'in'}},
      {from: {node: 'slowBatcher', port: 'out'}, to: {node: 'slowClose', port: 'in'}},
      {from: {node: 'fastClose', port: 'out'}, to: {node: 'fastSma', port: 'in'}},
      {from: {node: 'slowClose', port: 'out'}, to: {node: 'slowSma', port: 'in'}},
      {from: {node: 'fastSma', port: 'out'}, to: {node: 'crossover', port: 'a'}},
      {from: {node: 'slowSma', port: 'out'}, to: {node: 'crossover', port: 'b'}},
      {from: {node: 'crossover', port: 'true'}, to: {node: 'buy', port: 'when'}},
      {from: {node: 'crossover', port: 'false'}, to: {node: 'sell', port: 'when'}},
    ],
    name: 'SMA Crossover',
    nodes: {
      buy: {
        config: {
          amount: 'ALL_AVAILABLE_AMOUNT',
          amountIn: 'counter',
          reason: 'Fast SMA crossed above slow SMA',
          side: 'BUY',
        },
        position: {x: 1240, y: 40},
        type: 'advice',
      },
      candles: {position: {x: 40, y: 160}, type: 'source:candle'},
      crossover: {
        config: {operator: 'gt', trigger: 'onChange'},
        position: {x: 1000, y: 160},
        type: 'if',
      },
      fastBatcher: {config: {timeframe: fastTimeframe}, position: {x: 280, y: 40}, type: 'batcher'},
      fastClose: {config: {field: 'close'}, position: {x: 520, y: 40}, type: 'field'},
      fastSma: {config: {indicator: 'SMA', period: fastPeriod}, position: {x: 760, y: 40}, type: 'indicator'},
      sell: {
        config: {
          amount: 'ALL_AVAILABLE_AMOUNT',
          amountIn: 'base',
          reason: 'Fast SMA crossed below slow SMA',
          side: 'SELL',
        },
        position: {x: 1240, y: 280},
        type: 'advice',
      },
      slowBatcher: {config: {timeframe: slowTimeframe}, position: {x: 280, y: 280}, type: 'batcher'},
      slowClose: {config: {field: 'close'}, position: {x: 520, y: 280}, type: 'field'},
      slowSma: {config: {indicator: 'SMA', period: slowPeriod}, position: {x: 760, y: 280}, type: 'indicator'},
    },
    version: 1,
  };
}
