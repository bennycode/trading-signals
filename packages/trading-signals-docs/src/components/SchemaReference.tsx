import {useMemo} from 'react';
import type {z} from 'zod';
import {extractProperties} from '../utils/schemaProperties';

interface SchemaReferenceProps {
  schema: z.ZodType;
}

export function SchemaReference({schema}: SchemaReferenceProps) {
  const properties = useMemo(() => extractProperties(schema), [schema]);

  if (properties.length === 0) {
    return null;
  }

  return (
    <div className="mt-3">
      <details>
        <summary className="text-xs font-semibold demo-muted cursor-pointer hover:demo-text">Config reference</summary>
        <div className="mt-2">
          <PropertyTable properties={properties} />
        </div>
      </details>
    </div>
  );
}

function PropertyTable({properties}: {properties: ReturnType<typeof extractProperties>}) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left demo-muted">
          <th className="pb-1 pr-3 font-medium">Field</th>
          <th className="pb-1 font-medium">Type</th>
        </tr>
      </thead>
      <tbody className="demo-text">
        {properties.map(p => (
          <tr key={p.name} className="border-t demo-divider">
            <td className="py-1 pr-3 font-mono">
              {p.name}
              {!p.required && <span className="demo-muted">?</span>}
            </td>
            <td className="py-1 demo-muted">{p.type}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
