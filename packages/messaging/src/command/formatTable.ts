export interface TableColumn<T> {
  header: string;
  value: (row: T) => string;
  align?: 'left' | 'right';
}

/**
 * Renders a titled fixed-width table using the project's Telegram markdown
 * dialect: `**title**` for the bold header, then a fenced code block for the
 * monospaced table. See {@link markdownToTelegramHtml} for how these are
 * converted to Telegram HTML.
 */
export function formatTelegramTable<T>(title: string, rows: T[], columns: TableColumn<T>[]): string {
  const widths = columns.map(col => Math.max(col.header.length, ...rows.map(row => col.value(row).length)));

  const renderCells = (cells: string[]): string =>
    cells.map((cell, i) => (columns[i].align === 'right' ? cell.padStart(widths[i]) : cell.padEnd(widths[i]))).join('  ');

  const lines: string[] = [];
  lines.push(`**${title}**`);
  lines.push('```');
  lines.push(renderCells(columns.map(col => col.header)));
  lines.push(widths.map(w => '-'.repeat(w)).join('  '));
  for (const row of rows) {
    lines.push(renderCells(columns.map(col => col.value(row))));
  }
  lines.push('```');

  return lines.join('\n');
}
