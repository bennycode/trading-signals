import type {Edge, Node} from '@xyflow/react';
import type {StrategyGraphInput} from 'trading-strategies';

export interface BuilderNodeData extends Record<string, unknown> {
  nodeType: string;
  config: Record<string, unknown>;
}

export type BuilderNode = Node<BuilderNodeData, 'builder'>;

/**
 * The canvas state and the engine's graph JSON are two views of the same strategy;
 * these converters keep them losslessly interchangeable so copy/paste, templates,
 * and the backtest runner all speak the exact format `GraphStrategy` executes.
 */
export function toStrategyGraph(nodes: BuilderNode[], edges: Edge[], name?: string): StrategyGraphInput {
  return {
    connections: edges.map(edge => ({
      from: {node: edge.source, port: edge.sourceHandle ?? 'out'},
      to: {node: edge.target, port: edge.targetHandle ?? 'in'},
    })),
    name,
    nodes: Object.fromEntries(
      nodes.map(node => [
        node.id,
        {
          config: node.data.config,
          position: {x: node.position.x, y: node.position.y},
          type: node.data.nodeType,
        },
      ])
    ),
    version: 1,
  };
}

export function fromStrategyGraph(graph: StrategyGraphInput): {nodes: BuilderNode[]; edges: Edge[]} {
  const nodes: BuilderNode[] = Object.entries(graph.nodes).map(([id, node], index) => ({
    data: {config: node.config ?? {}, nodeType: node.type},
    id,
    position: node.position ?? {x: 80 + index * 220, y: 80},
    type: 'builder',
  }));

  const edges: Edge[] = graph.connections.map((connection, index) => ({
    id: `edge-${index}`,
    source: connection.from.node,
    sourceHandle: connection.from.port ?? 'out',
    target: connection.to.node,
    targetHandle: connection.to.port ?? 'in',
  }));

  return {edges, nodes};
}
