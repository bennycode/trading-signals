import {useMemo} from 'react';
import type {z} from 'zod';
import {extractProperties, extractNestedProperties} from '../utils/schemaProperties';

interface SchemaReferenceProps {
  schema: z.ZodType;
}

export function SchemaReference({schema}: SchemaReferenceProps) {
  const {topLevel, protectedProps} = useMemo(() => {
    const all = extractProperties(schema);
    const top = all.filter(p => p.name !== 'protected');
    const nested = extractNestedProperties(schema, 'protected');
    return {topLevel: top, protectedProps: nested};
  }, [schema]);

  if (topLevel.length === 0 && protectedProps.length === 0) {
    return null;
  }

  return (
    <div className="mt-3">
      <details>
        <summary className="text-xs font-semibold text-slate-400 cursor-pointer hover:text-slate-300">
          Config reference
        </summary>
        <div className="mt-2 space-y-3">
          {topLevel.length > 0 && <PropertyTable properties={topLevel} />}
          {protectedProps.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">
                protected <span className="font-normal text-slate-600">(nested)</span>
              </p>
              <PropertyTable properties={protectedProps} />
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

function PropertyTable({properties}: {properties: ReturnType<typeof extractProperties>}) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-slate-500">
          <th className="pb-1 pr-3 font-medium">Field</th>
          <th className="pb-1 font-medium">Type</th>
        </tr>
      </thead>
      <tbody className="text-slate-300">
        {properties.map(p => (
          <tr key={p.name} className="border-t border-slate-700/50">
            <td className="py-1 pr-3 font-mono">
              {p.name}
              {!p.required && <span className="text-slate-600">?</span>}
            </td>
            <td className="py-1 text-slate-400">{p.type}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
