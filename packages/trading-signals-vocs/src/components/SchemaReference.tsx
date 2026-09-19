import {useMemo} from 'react';
import type {z} from 'zod';
import {extractProperties, extractNestedProperties} from '../utils/schemaProperties';

interface SchemaReferenceProps {
  schema: z.ZodType;
}

export function SchemaReference({schema}: SchemaReferenceProps) {
  const {protectedProps, topLevel} = useMemo(() => {
    const all = extractProperties(schema);
    const top = all.filter(p => p.name !== 'protected');
    const nested = extractNestedProperties(schema, 'protected');
    return {protectedProps: nested, topLevel: top};
  }, [schema]);

  if (topLevel.length === 0 && protectedProps.length === 0) {
    return null;
  }

  return (
    <div className="mt-3">
      <details>
        <summary className="text-xs font-semibold demo-muted cursor-pointer hover:demo-text">Config reference</summary>
        <div className="mt-2 space-y-3">
          {topLevel.length > 0 && <PropertyTable properties={topLevel} />}
          {protectedProps.length > 0 && (
            <div>
              <p className="text-xs font-semibold demo-muted mb-1">
                protected <span className="font-normal demo-muted">(nested)</span>
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
