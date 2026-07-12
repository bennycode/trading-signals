import {useCallback, useEffect, useMemo, useRef} from 'react';
import {Background, Controls, ReactFlow, addEdge, useEdgesState, useNodesState} from '@xyflow/react';
import type {Connection, Edge, IsValidConnection} from '@xyflow/react';
import {getNodeTypeDefinition, getNodeTypes} from 'trading-strategies';
import type {StrategyGraphInput} from 'trading-strategies';
import type {BuilderNode} from '../../utils/graphIO';
import {fromStrategyGraph, toStrategyGraph} from '../../utils/graphIO';
import {PORT_COLORS, createBuilderNodeView} from './BuilderNodeView';

interface GraphEditorProps {
  initialGraph: StrategyGraphInput;
  onGraphChange: (graph: StrategyGraphInput) => void;
}

const CATEGORY_DOTS: Record<string, string> = {
  indicator: 'bg-sky-500',
  logic: 'bg-violet-500',
  sink: 'bg-emerald-500',
  source: 'bg-amber-500',
  transform: 'bg-orange-400',
};

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

export function GraphEditor({initialGraph, onGraphChange}: GraphEditorProps) {
  const initial = useMemo(() => fromStrategyGraph(initialGraph), [initialGraph]);
  const [nodes, setNodes, onNodesChange] = useNodesState<BuilderNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    initial.edges.map(edge => styleEdge(edge, initial.nodes))
  );
  const nextNodeNumber = useRef(1);

  const onConfigChange = useCallback(
    (nodeId: string, key: string, value: unknown) => {
      setNodes(current =>
        current.map(node =>
          node.id === nodeId ? {...node, data: {...node.data, config: {...node.data.config, [key]: value}}} : node
        )
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
      setNodes(current => {
        let id = `${shortName}-${nextNodeNumber.current}`;
        while (current.some(node => node.id === id)) {
          nextNodeNumber.current += 1;
          id = `${shortName}-${nextNodeNumber.current}`;
        }
        nextNodeNumber.current += 1;
        // Grid placement right of the palette so fresh nodes never hide behind it or each other.
        const column = current.length % 4;
        const row = Math.floor(current.length / 4);
        const newNode: BuilderNode = {
          data: {config: {}, nodeType},
          id,
          position: {x: 240 + column * 240, y: 40 + row * 300},
          type: 'builder',
        };
        return [...current, newNode];
      });
    },
    [setNodes]
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
