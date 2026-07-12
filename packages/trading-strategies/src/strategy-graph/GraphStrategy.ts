import type {MarketDataSource, OneMinuteBatchedCandle, TradingPair} from '@typedtrader/exchange';
import type {OrderAdvice, TradingSessionState} from '../trader/index.js';
import {Strategy} from '../strategy/Strategy.js';
import type {StrategyGraph, StrategyGraphInput} from './GraphSchema.js';
import {StrategyGraphSchema} from './GraphSchema.js';
import {getNodeTypeDefinition} from './NodeRegistry.js';
import type {NodeEvaluator, NodeInputState, NodeTypeDefinition} from './NodeRegistry.js';

interface CompiledNode {
  id: string;
  definition: NodeTypeDefinition;
  evaluator: NodeEvaluator;
  /** Which upstream output feeds each of this node's input ports. */
  inputSources: Map<string, string>;
}

const outputKey = (node: string, port: string) => `${node}:${port}`;

/**
 * Runs a declarative {@link StrategyGraph} as a real trading strategy. Because it satisfies the
 * same contract as hand-written strategies, graphs built in the visual editor backtest and trade
 * through the exact same executors — there is no separate "toy" runtime whose results could
 * diverge from production behavior.
 */
export class GraphStrategy extends Strategy {
  static override NAME = '@typedtrader/strategy-graph';

  readonly #nodes: CompiledNode[];

  /**
   * Latest value each output port ever emitted. Holding values between ticks is what lets a
   * fast 1m indicator compare against the last *closed* bar of a slow 5m indicator.
   */
  readonly #heldValues = new Map<string, unknown>();

  constructor(graph: StrategyGraphInput) {
    const parsed = StrategyGraphSchema.parse(graph);
    super({config: parsed});
    this.#nodes = GraphStrategy.#compile(parsed);
  }

  /** Forwards the session's init to every node evaluator, in evaluation order. */
  async init(market: Pick<MarketDataSource, 'getRecentCandles'>, pair: TradingPair): Promise<void> {
    for (const node of this.#nodes) {
      await node.evaluator.init?.({market, pair});
    }
  }

  protected override async processCandle(
    candle: OneMinuteBatchedCandle,
    _state: TradingSessionState
  ): Promise<OrderAdvice | void> {
    const emittedThisTick = new Set<string>();
    let advice: OrderAdvice | undefined = undefined;

    for (const node of this.#nodes) {
      const inputs: Record<string, NodeInputState | undefined> = {};
      for (const port of node.definition.inputs) {
        const source = node.inputSources.get(port.name);
        if (source !== undefined && this.#heldValues.has(source)) {
          inputs[port.name] = {isFresh: emittedThisTick.has(source), value: this.#heldValues.get(source)};
        } else {
          inputs[port.name] = undefined;
        }
      }

      const evaluation = await node.evaluator.evaluate(inputs, {candle});

      for (const [port, value] of Object.entries(evaluation.outputs ?? {})) {
        const key = outputKey(node.id, port);
        this.#heldValues.set(key, value);
        emittedThisTick.add(key);
      }

      // If several advice nodes fire on the same tick, the first in evaluation order wins.
      if (evaluation.advice && !advice) {
        advice = evaluation.advice;
      }
    }

    return advice;
  }

  static #compile(graph: StrategyGraph): CompiledNode[] {
    const nodeIds = Object.keys(graph.nodes);
    if (nodeIds.length === 0) {
      throw new Error('Graph has no nodes');
    }

    const definitions = new Map<string, NodeTypeDefinition>();
    const parsedConfigs = new Map<string, unknown>();

    for (const [id, node] of Object.entries(graph.nodes)) {
      const definition = getNodeTypeDefinition(node.type);
      if (!definition) {
        throw new Error(`Node "${id}": unknown node type "${node.type}"`);
      }
      definitions.set(id, definition);
      const result = definition.configSchema.safeParse(node.config ?? {});
      if (!result.success) {
        const issues = result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ');
        throw new Error(`Node "${id}": invalid config — ${issues}`);
      }
      parsedConfigs.set(id, result.data);
    }

    const inputSourcesByNode = new Map<string, Map<string, string>>(nodeIds.map(id => [id, new Map()]));

    for (const {from, to} of graph.connections) {
      const fromDefinition = definitions.get(from.node);
      const toDefinition = definitions.get(to.node);
      if (!fromDefinition) {
        throw new Error(`Connection references unknown node "${from.node}"`);
      }
      if (!toDefinition) {
        throw new Error(`Connection references unknown node "${to.node}"`);
      }
      const output = fromDefinition.outputs.find(port => port.name === from.port);
      if (!output) {
        throw new Error(`Node "${from.node}" (${fromDefinition.label}) has no output port "${from.port}"`);
      }
      const input = toDefinition.inputs.find(port => port.name === to.port);
      if (!input) {
        throw new Error(`Node "${to.node}" (${toDefinition.label}) has no input port "${to.port}"`);
      }
      if (output.kind !== input.kind) {
        throw new Error(
          `Type mismatch: "${from.node}:${from.port}" emits ${output.kind} but "${to.node}:${to.port}" expects ${input.kind}`
        );
      }
      const inputSources = inputSourcesByNode.get(to.node)!;
      if (inputSources.has(to.port)) {
        throw new Error(`Node "${to.node}": input port "${to.port}" has more than one incoming connection`);
      }
      inputSources.set(to.port, outputKey(from.node, from.port));
    }

    for (const [id, definition] of definitions) {
      const inputSources = inputSourcesByNode.get(id)!;
      for (const port of definition.inputs) {
        if (!inputSources.has(port.name)) {
          throw new Error(`Node "${id}" (${definition.label}): input port "${port.name}" is not connected`);
        }
      }
    }

    return GraphStrategy.#sortTopologically(graph, definitions).map(id => ({
      definition: definitions.get(id)!,
      evaluator: definitions.get(id)!.createEvaluator(parsedConfigs.get(id)),
      id,
      inputSources: inputSourcesByNode.get(id)!,
    }));
  }

  /** Kahn's algorithm. Also the cycle detector: a cycle leaves nodes with unresolved inputs. */
  static #sortTopologically(graph: StrategyGraph, definitions: Map<string, NodeTypeDefinition>): string[] {
    const nodeIds = Object.keys(graph.nodes);
    const dependents = new Map<string, string[]>(nodeIds.map(id => [id, []]));
    const pendingInputs = new Map<string, number>(nodeIds.map(id => [id, 0]));

    for (const {from, to} of graph.connections) {
      dependents.get(from.node)!.push(to.node);
      pendingInputs.set(to.node, pendingInputs.get(to.node)! + 1);
    }

    const queue = nodeIds.filter(id => pendingInputs.get(id) === 0);
    const order: string[] = [];

    while (queue.length > 0) {
      const id = queue.shift()!;
      order.push(id);
      for (const dependent of dependents.get(id)!) {
        const remaining = pendingInputs.get(dependent)! - 1;
        pendingInputs.set(dependent, remaining);
        if (remaining === 0) {
          queue.push(dependent);
        }
      }
    }

    if (order.length !== nodeIds.length) {
      const stuck = nodeIds.filter(id => !order.includes(id));
      throw new Error(`Graph contains a cycle involving: ${stuck.map(id => `"${id}"`).join(', ')}`);
    }

    // Guarantee at least one path can produce advice; a graph without a sink can never trade.
    if (![...definitions.values()].some(definition => definition.category === 'sink')) {
      throw new Error('Graph has no advice node — it can never produce a trade');
    }

    return order;
  }
}
