import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Background, Controls, ReactFlow, addEdge, useEdgesState, useNodesState} from '@xyflow/react';
import type {Connection, Edge, IsValidConnection} from '@xyflow/react';
import {getNodeTypeDefinition, getNodeTypes} from 'trading-strategies';
import type {StrategyGraphInput} from 'trading-strategies';
import type {BuilderNode} from '../../utils/graphIO';
import {fromStrategyGraph, toStrategyGraph} from '../../utils/graphIO';
import {NODE_FIELDS} from './nodeFields';
import {PORT_COLORS, createBuilderNodeView} from './BuilderNodeView';

/** A new object (even with an identical graph) is what tells the editor to apply a reset. */
export interface GraphResetSignal {
  graph: StrategyGraphInput;
  token: number;
}

interface GraphEditorProps {
  initialGraph: StrategyGraphInput;
  onGraphChange: (graph: StrategyGraphInput) => void;
  /**
   * Set by the page to replace the whole canvas (Clear/Template/JSON import) — a bumped
   * `token` applies `graph` without unmounting React Flow. `next/dynamic` doesn't forward
   * refs to the loaded component's own imperative handle (it hijacks the ref for its own
   * `{retry}` API), so a plain prop is the reliable way to command a reset across that
   * dynamic-import boundary.
   */
  resetSignal: GraphResetSignal | null;
}

const CATEGORY_DOTS: Record<string, string> = {
  indicator: 'bg-sky-500',
  logic: 'bg-violet-500',
  sink: 'bg-emerald-500',
  source: 'bg-amber-500',
  transform: 'bg-orange-400',
};

const GRID_COLUMNS = 4;
const COLUMN_WIDTH = 240;
const GRID_ORIGIN_X = 240;
const GRID_ORIGIN_Y = 40;
const NODE_GAP_Y = 24;
const NODE_HEADER_HEIGHT = 56;
const PORT_LABEL_ROW_HEIGHT = 20;
const FIELD_ROW_HEIGHT = 34;
const NODE_BOTTOM_PADDING = 12;

/**
 * Nodes vary in height (an `advice` node with 4 config fields is much taller than a bare
 * `source:candle` node). A fixed row height would let tall nodes overlap the row below, so
 * placement uses this estimate to pack nodes shelf-style instead of a uniform grid.
 */
function estimateNodeHeight(nodeType: string) {
  const definition = getNodeTypeDefinition(nodeType);
  const portRows = definition ? Math.max(definition.inputs.length, definition.outputs.length) : 0;
  const fieldRows = NODE_FIELDS[nodeType]?.length ?? 0;
  return NODE_HEADER_HEIGHT + portRows * PORT_LABEL_ROW_HEIGHT + fieldRows * FIELD_ROW_HEIGHT + NODE_BOTTOM_PADDING;
}

/** Buckets already-placed nodes (template load, JSON import, manual drags) into their nearest column. */
function columnHeightsFor(nodes: readonly BuilderNode[]): number[] {
  const heights = Array<number>(GRID_COLUMNS).fill(GRID_ORIGIN_Y);
  for (const node of nodes) {
    const column = Math.min(
      GRID_COLUMNS - 1,
      Math.max(0, Math.round((node.position.x - GRID_ORIGIN_X) / COLUMN_WIDTH))
    );
    const bottom = node.position.y + estimateNodeHeight(node.data.nodeType) + NODE_GAP_Y;
    heights[column] = Math.max(heights[column], bottom);
  }
  return heights;
}

function styleEdge(edge: Edge, nodes: BuilderNode[]): Edge {
  const source = nodes.find(node => node.id === edge.source);
  const definition = source ? getNodeTypeDefinition(source.data.nodeType) : undefined;
  const kind = definition?.outputs.find(port => port.name === (edge.sourceHandle ?? 'out'))?.kind;
  return {
    ...edge,
    animated: kind === 'trigger',
    style: {stroke: kind ? PORT_COLORS[kind] : '#64748b', strokeWidth: 2},
  };
}

export function GraphEditor({initialGraph, onGraphChange, resetSignal}: GraphEditorProps) {
  /*
   * `initialGraph` seeds the very first render only; later resets arrive via `resetSignal`
   * below so the canvas (viewport, React Flow internals) never has to unmount.
   */
  const [initial] = useState(() => fromStrategyGraph(initialGraph));
  const [nodes, setNodes, onNodesChange] = useNodesState<BuilderNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    initial.edges.map(edge => styleEdge(edge, initial.nodes))
  );
  const columnHeights = useRef<number[]>(columnHeightsFor(initial.nodes));
  const lastAppliedToken = useRef<number | null>(null);

  useEffect(() => {
    if (!resetSignal || resetSignal.token === lastAppliedToken.current) {
      return;
    }
    lastAppliedToken.current = resetSignal.token;
    const converted = fromStrategyGraph(resetSignal.graph);
    columnHeights.current = columnHeightsFor(converted.nodes);
    setNodes(converted.nodes);
    setEdges(converted.edges.map(edge => styleEdge(edge, converted.nodes)));
  }, [resetSignal, setNodes, setEdges]);

  const onConfigChange = useCallback(
    (nodeId: string, key: string, value: unknown) => {
      setNodes(current =>
        current.map(node => {
          if (node.id !== nodeId) {
            return node;
          }
          const config = {...node.data.config};
          // `undefined` means "unset" — remove the key so the node's schema default applies.
          if (value === undefined) {
            delete config[key];
          } else {
            config[key] = value;
          }
          return {...node, data: {...node.data, config}};
        })
      );
    },
    [setNodes]
  );

  const onDelete = useCallback(
    (nodeId: string) => {
      setNodes(current => current.filter(node => node.id !== nodeId));
      setEdges(current => current.filter(edge => edge.source !== nodeId && edge.target !== nodeId));
    },
    [setNodes, setEdges]
  );

  const nodeTypes = useMemo(
    () => ({builder: createBuilderNodeView({onConfigChange, onDelete})}),
    [onConfigChange, onDelete]
  );

  /**
   * The Scratch guarantee: a connection between mismatched port kinds (or into an
   * already-occupied input) simply refuses to snap.
   */
  const isValidConnection: IsValidConnection = useCallback(
    connection => {
      const source = nodes.find(node => node.id === connection.source);
      const target = nodes.find(node => node.id === connection.target);
      if (!source || !target || connection.source === connection.target) {
        return false;
      }
      const sourceDefinition = getNodeTypeDefinition(source.data.nodeType);
      const targetDefinition = getNodeTypeDefinition(target.data.nodeType);
      const output = sourceDefinition?.outputs.find(port => port.name === (connection.sourceHandle ?? 'out'));
      const input = targetDefinition?.inputs.find(port => port.name === (connection.targetHandle ?? 'in'));
      if (!output || !input || output.kind !== input.kind) {
        return false;
      }
      const occupied = edges.some(
        edge => edge.target === connection.target && (edge.targetHandle ?? 'in') === (connection.targetHandle ?? 'in')
      );
      return !occupied;
    },
    [nodes, edges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges(current => addEdge(connection, current).map(edge => styleEdge(edge, nodes)));
    },
    [setEdges, nodes]
  );

  const addNode = useCallback(
    (nodeType: string) => {
      const shortName = nodeType.replace('source:', '');
      let suffix = nodes.length + 1;
      let id = `${shortName}-${suffix}`;
      while (nodes.some(node => node.id === id)) {
        suffix += 1;
        id = `${shortName}-${suffix}`;
      }
      // Shelf-pack into the shortest column so a tall node never overlaps the one placed after it.
      const heights = columnHeights.current;
      const column = heights.indexOf(Math.min(...heights));
      const position = {x: GRID_ORIGIN_X + column * COLUMN_WIDTH, y: heights[column]};
      heights[column] += estimateNodeHeight(nodeType) + NODE_GAP_Y;

      const newNode: BuilderNode = {data: {config: {}, nodeType}, id, position, type: 'builder'};
      setNodes(current => [...current, newNode]);
    },
    [nodes, setNodes]
  );

  useEffect(() => {
    onGraphChange(toStrategyGraph(nodes, edges));
  }, [nodes, edges, onGraphChange]);

  return (
    <div className="flex gap-3 items-stretch">
      {/* Palette lives beside the canvas, never on top of it — nodes can't hide behind it. */}
      <div className="w-44 shrink-0 bg-slate-800/50 border border-slate-700 rounded-lg p-2 space-y-1 self-start">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 px-1 pb-1">Building blocks</div>
        {getNodeTypes().map(definition => (
          <button
            key={definition.type}
            data-testid={`palette-${definition.type}`}
            title={definition.description}
            onClick={() => addNode(definition.type)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer text-left">
            <span className={`h-2 w-2 rounded-full shrink-0 ${CATEGORY_DOTS[definition.category] ?? 'bg-slate-500'}`} />
            <span>+ {definition.label}</span>
          </button>
        ))}
        <div className="text-[10px] text-slate-500 px-1 pt-1 border-t border-slate-700">
          Drag between matching-color ports to connect. Backspace deletes.
        </div>
      </div>
      <div
        className="flex-1 min-w-0 h-[640px] rounded-lg border border-slate-700 overflow-hidden"
        data-testid="graph-canvas">
        <ReactFlow
          colorMode="dark"
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          deleteKeyCode={['Backspace', 'Delete']}
          fitView
          fitViewOptions={{padding: 0.1}}
          minZoom={0.3}>
          <Background gap={20} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
