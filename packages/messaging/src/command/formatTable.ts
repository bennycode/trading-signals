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
export function formatTelegramTable<T>(title: string, rows: T[], columns: TableColumn<T>[]) {
  const widths = columns.map(col => Math.max(col.header.length, ...rows.map(row => col.value(row).length)));

  const renderCells = (cells: string[]) =>
    cells
      .map((cell, index) => {
        // Cells are rendered against the columns they came from, so the two walk together.
        const width = widths[index] ?? cell.length;
        return columns[index]?.align === 'right' ? cell.padStart(width) : cell.padEnd(width);
      })
      .join('  ');

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
