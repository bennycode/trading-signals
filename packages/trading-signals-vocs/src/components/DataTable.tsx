import React from 'react';
import {CollapsibleCard} from './CollapsibleCard';

interface TableColumn<T> {
  header: string;
  key: keyof T;
  render?: (value: any, row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  title?: string;
  columns: TableColumn<T>[];
  data: T[];
}

export function DataTable<T extends Record<string, any>>({columns, data, title}: DataTableProps<T>) {
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
                const content = col.render ? col.render(value, row) : value;
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
