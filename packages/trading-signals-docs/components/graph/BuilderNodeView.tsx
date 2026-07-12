import {Handle, Position} from '@xyflow/react';
import type {NodeProps} from '@xyflow/react';
import {getNodeTypeDefinition} from 'trading-strategies';
import type {NodePortDefinition, PortValueKind} from 'trading-strategies';
import type {BuilderNode} from '../../utils/graphIO';
import {NODE_FIELDS} from './nodeFields';

/** Ports snap only to matching colors — the visual grammar for "these blocks fit together". */
export const PORT_COLORS: Record<PortValueKind, string> = {
  candle: '#f59e0b',
  number: '#38bdf8',
  trigger: '#a78bfa',
};

const CATEGORY_ACCENTS: Record<string, string> = {
  indicator: 'border-t-sky-500',
  logic: 'border-t-violet-500',
  sink: 'border-t-emerald-500',
  source: 'border-t-amber-500',
  transform: 'border-t-orange-400',
};

const HANDLE_TOP_OFFSET = 46;
const HANDLE_SPACING = 26;

function portHandles(ports: readonly NodePortDefinition[], type: 'source' | 'target') {
  const position = type === 'target' ? Position.Left : Position.Right;
  return ports.map((port, index) => (
    <Handle
      key={port.name}
      id={port.name}
      type={type}
      position={position}
      style={{
        background: PORT_COLORS[port.kind],
        height: 10,
        top: HANDLE_TOP_OFFSET + index * HANDLE_SPACING,
        width: 10,
      }}
    />
  ));
}

function portLabels(inputs: readonly NodePortDefinition[], outputs: readonly NodePortDefinition[]) {
  const rows = Math.max(inputs.length, outputs.length);
  if (rows === 0) {
    return null;
  }
  return (
    <div className="px-3 pt-1.5 space-y-1.5">
      {Array.from({length: rows}, (_, index) => (
        <div key={index} className="flex justify-between text-[10px] leading-4 text-slate-400 h-4">
          <span>{inputs[index]?.label ?? ''}</span>
          <span>{outputs[index]?.label ?? ''}</span>
        </div>
      ))}
    </div>
  );
}

export interface BuilderNodeCallbacks {
  onConfigChange: (nodeId: string, key: string, value: unknown) => void;
  onDelete: (nodeId: string) => void;
}

export function createBuilderNodeView({onConfigChange, onDelete}: BuilderNodeCallbacks) {
  return function BuilderNodeView({data, id, selected}: NodeProps<BuilderNode>) {
    const definition = getNodeTypeDefinition(data.nodeType);
    if (!definition) {
      return <div className="bg-red-900 text-red-200 text-xs rounded p-2">Unknown node: {data.nodeType}</div>;
    }
    const fields = NODE_FIELDS[data.nodeType] ?? [];
    const accent = CATEGORY_ACCENTS[definition.category] ?? 'border-t-slate-500';

    return (
      <div
        data-testid={`node-${id}`}
        className={`bg-slate-800 border border-t-4 rounded-lg shadow-lg w-52 ${accent} ${
          selected ? 'border-x-purple-400 border-b-purple-400' : 'border-x-slate-600 border-b-slate-600'
        }`}>
        {portHandles(definition.inputs, 'target')}
        {portHandles(definition.outputs, 'source')}
        <div className="px-3 pt-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">{definition.label}</div>
            <div className="text-[10px] text-slate-500 truncate" title={id}>
              {id}
            </div>
          </div>
          <button
            data-testid={`node-${id}-delete`}
            aria-label={`Delete ${definition.label} node`}
            title="Delete node"
            onClick={() => onDelete(id)}
            className="nodrag shrink-0 -mr-1 h-5 w-5 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-red-500/70 transition-colors cursor-pointer text-xs leading-none">
            ✕
          </button>
        </div>
        {portLabels(definition.inputs, definition.outputs)}
        {fields.length > 0 && (
          <div className="px-3 pb-2.5 pt-1 space-y-1.5">
            {fields.map(field => {
              const value = data.config[field.key];
              const common =
                'nodrag w-full bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-xs text-white focus:outline-none focus:border-purple-500';
              return (
                <label key={field.key} className="block">
                  <span className="block text-[10px] text-slate-400 mb-0.5">{field.label}</span>
                  {field.widget === 'select' ? (
                    <select
                      data-testid={`node-${id}-${field.key}`}
                      className={common}
                      value={String(value ?? field.options?.[0]?.value ?? '')}
                      onChange={event => onConfigChange(id, field.key, event.target.value)}>
                      {field.options?.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      data-testid={`node-${id}-${field.key}`}
                      className={common}
                      type={field.widget === 'number' ? 'number' : 'text'}
                      placeholder={field.placeholder}
                      value={value === undefined ? '' : String(value)}
                      onChange={event =>
                        onConfigChange(
                          id,
                          field.key,
                          field.widget === 'number' ? Number(event.target.value) : event.target.value
                        )
                      }
                    />
                  )}
                </label>
              );
            })}
          </div>
        )}
        {fields.length === 0 && <div className="pb-2.5" />}
      </div>
    );
  };
}
