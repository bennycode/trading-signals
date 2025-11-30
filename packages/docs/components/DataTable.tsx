import {SignalBadge} from './SignalBadge';

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

export function DataTable<T extends Record<string, any>>({title, columns, data}: DataTableProps<T>) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
      {title && <h3 className="text-lg font-semibold text-white mb-3">{title}</h3>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-600">
              {columns.map((col, idx) => (
                <th key={idx} className="text-left text-slate-300 py-2 px-3">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-b border-slate-700/50">
                {columns.map((col, colIdx) => {
                  const value = row[col.key];
                  const content = col.render ? col.render(value, row) : value;
                  const className = col.className || 'text-slate-400 py-2 px-3';

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
    </div>
  );
}
