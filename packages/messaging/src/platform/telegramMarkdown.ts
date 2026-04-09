import {MESSAGE_BREAK} from 'trading-strategies';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, ch => HTML_ESCAPES[ch]);
}

function convertOutsideCode(text: string): string {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

/**
 * Convert the minimal markdown used by reports into Telegram HTML parse mode:
 *
 * - `**bold**` → `<b>bold</b>`
 * - fenced code blocks (```` ``` ````) → `<pre>...</pre>` (monospace, preserves whitespace)
 * - `&`, `<`, `>` escaped to entities
 *
 * Other markdown is passed through as plain text.
 */
export function markdownToTelegramHtml(markdown: string): string {
  const parts: string[] = [];
  const codeBlockRegex = /```(?:\w*\n)?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    if (match.index > lastIndex) {
      parts.push(convertOutsideCode(markdown.slice(lastIndex, match.index)));
    }
    const code = match[1].replace(/^\n+|\n+$/g, '');
    parts.push(`<pre>${escapeHtml(code)}</pre>`);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < markdown.length) {
    parts.push(convertOutsideCode(markdown.slice(lastIndex)));
  }

  return parts.join('');
}

/**
 * Telegram rejects text messages longer than 4096 characters. We use 3900 to
 * leave headroom for the `**` → `<b>` expansion performed by
 * {@link markdownToTelegramHtml}.
 */
const TELEGRAM_MAX_CHUNK = 3900;

/**
 * Split a long markdown message into chunks that fit Telegram's per-message
 * limit. Forced section breaks from {@link MESSAGE_BREAK} are honored first;
 * within each section, splits prefer paragraph (`\n\n`) boundaries, then line
 * (`\n`) boundaries, and only hard-split a single line as a last resort.
 */
export function splitForTelegram(markdown: string, maxLength = TELEGRAM_MAX_CHUNK): string[] {
  // Honor forced section breaks first. Strip the surrounding newlines that end
  // up around the marker after line-join so each section starts cleanly.
  const sections = markdown
    .split(MESSAGE_BREAK)
    .map(section => section.replace(/^\n+|\n+$/g, ''))
    .filter(section => section.length > 0);

  if (sections.length > 1) {
    return sections.flatMap(section => splitSectionForTelegram(section, maxLength));
  }

  return splitSectionForTelegram(sections[0] ?? '', maxLength);
}

function splitSectionForTelegram(markdown: string, maxLength: number): string[] {
  if (markdown.length === 0) {
    return [];
  }
  if (markdown.length <= maxLength) {
    return [markdown];
  }

  const chunks: string[] = [];
  let current = '';

  const flush = () => {
    if (current) {
      chunks.push(current);
      current = '';
    }
  };

  const tryAppend = (piece: string, separator: string): boolean => {
    const candidate = current ? current + separator + piece : piece;
    if (candidate.length <= maxLength) {
      current = candidate;
      return true;
    }
    return false;
  };

  for (const paragraph of markdown.split('\n\n')) {
    if (tryAppend(paragraph, '\n\n')) continue;
    flush();
    if (paragraph.length <= maxLength) {
      current = paragraph;
      continue;
    }
    // Paragraph too big on its own — fall back to per-line splitting
    for (const line of paragraph.split('\n')) {
      if (tryAppend(line, '\n')) continue;
      flush();
      if (line.length <= maxLength) {
        current = line;
      } else {
        // Single line exceeds the limit — hard split
        for (let i = 0; i < line.length; i += maxLength) {
          chunks.push(line.slice(i, i + maxLength));
        }
      }
    }
  }
  flush();
  return chunks;
}
