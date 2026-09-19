import {isValidElement, type ReactNode} from 'react';
import type {ColumnDef} from '../utils/types';
import {CollapsibleCard} from './CollapsibleCard';

interface DataTableProps {
  title?: string;
  columns: ColumnDef[];
  data: Record<string, unknown>[];
}

function toCell(value: unknown): ReactNode {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    isValidElement(value)
  ) {
    return value;
  }
  return String(value);
}

export function DataTable({columns, data, title}: DataTableProps) {
  const table = (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b demo-divider">
            {columns.map((col, idx) => (
              <th key={idx} className="text-left demo-text py-2 px-3">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr key={rowIdx} className="border-b demo-divider">
              {columns.map((col, colIdx) => {
                const value = row[col.key];
                const content = col.render ? col.render(value, row) : toCell(value);
                const className = col.className || 'demo-muted py-2 px-3';

                return (
                  <td key={colIdx} className={className}>
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (title) {
    return <CollapsibleCard title={title}>{table}</CollapsibleCard>;
  }

  return <div className="demo-card">{table}</div>;
}
