import {describe, expect, it} from 'vitest';
import {MESSAGE_BREAK} from 'trading-strategies';
import {markdownToTelegramHtml, splitForTelegram} from './telegramMarkdown.js';

describe('markdownToTelegramHtml', () => {
  it('converts **bold** to <b>', () => {
    expect(markdownToTelegramHtml('**Report:** done')).toBe('<b>Report:</b> done');
  });

  it('escapes &, <, > to HTML entities', () => {
    expect(markdownToTelegramHtml('A & B <tag>')).toBe('A &amp; B &lt;tag&gt;');
  });

  it('escapes HTML before applying bold so ** inside tags does not break', () => {
    expect(markdownToTelegramHtml('**A & B**')).toBe('<b>A &amp; B</b>');
  });

  it('leaves plain text untouched', () => {
    expect(markdownToTelegramHtml('no formatting here')).toBe('no formatting here');
  });

  it('wraps fenced code blocks in <pre>', () => {
    const input = 'Header\n```\nRank  Stock\n  1  AAPL\n```\nFooter';
    expect(markdownToTelegramHtml(input)).toBe('Header\n<pre>Rank  Stock\n  1  AAPL</pre>\nFooter');
  });

  it('escapes HTML entities inside code blocks', () => {
    expect(markdownToTelegramHtml('```\nA & <B>\n```')).toBe('<pre>A &amp; &lt;B&gt;</pre>');
  });

  it('does not apply **bold** conversion inside code blocks', () => {
    expect(markdownToTelegramHtml('```\n**not bold**\n```')).toBe('<pre>**not bold**</pre>');
  });

  it('ignores an optional language tag on the opening fence', () => {
    expect(markdownToTelegramHtml('```js\nconst x = 1;\n```')).toBe('<pre>const x = 1;</pre>');
  });
});

describe('splitForTelegram', () => {
  it('returns a single chunk when the text fits', () => {
    expect(splitForTelegram('short text', 100)).toEqual(['short text']);
  });

  it('splits at paragraph boundaries when possible', () => {
    const text = 'A'.repeat(50) + '\n\n' + 'B'.repeat(50) + '\n\n' + 'C'.repeat(50);
    const chunks = splitForTelegram(text, 60);
    expect(chunks).toEqual(['A'.repeat(50), 'B'.repeat(50), 'C'.repeat(50)]);
  });

  it('merges small paragraphs into one chunk when they fit together', () => {
    const text = 'small\n\nparagraphs\n\nhere';
    expect(splitForTelegram(text, 100)).toEqual([text]);
  });

  it('falls back to line splitting when a paragraph exceeds the limit', () => {
    const paragraph = Array.from({length: 5}, (_, i) => `line ${i + 1}`).join('\n');
    // "line 1\nline 2\nline 3\nline 4\nline 5" is 34 chars, each line is 6
    const chunks = splitForTelegram(paragraph, 15);
    expect(chunks).toEqual(['line 1\nline 2', 'line 3\nline 4', 'line 5']);
  });

  it('hard-splits a single line that exceeds the limit', () => {
    expect(splitForTelegram('X'.repeat(10), 4)).toEqual(['XXXX', 'XXXX', 'XX']);
  });

  it('honors MESSAGE_BREAK markers as forced section splits', () => {
    const text = `**Section 1**\nline a\n${MESSAGE_BREAK}\n**Section 2**\nline b\n${MESSAGE_BREAK}\n**Section 3**\nline c`;
    expect(splitForTelegram(text)).toEqual([
      '**Section 1**\nline a',
      '**Section 2**\nline b',
      '**Section 3**\nline c',
    ]);
  });

  it('still size-splits within a section that exceeds the limit after a forced break', () => {
    const bigSection = Array.from({length: 10}, (_, i) => `line ${i + 1}`).join('\n');
    const text = `small${MESSAGE_BREAK}${bigSection}`;
    const chunks = splitForTelegram(text, 20);
    expect(chunks[0]).toBe('small');
    expect(chunks.length).toBeGreaterThan(2);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(20);
    }
  });

  it('drops empty sections produced by consecutive markers', () => {
    const text = `a${MESSAGE_BREAK}${MESSAGE_BREAK}b`;
    expect(splitForTelegram(text)).toEqual(['a', 'b']);
  });

  it('keeps chunks under the default Telegram limit for a realistic report', () => {
    // Simulate a report with 100 numbered items in a single paragraph, each ~60 chars.
    // Total ~6000 chars, forcing a split.
    const lines = Array.from({length: 100}, (_, i) => `${i + 1}. Some Company Name (TICKER) — detail one, detail two`);
    const longReport = '**Header**\n' + lines.join('\n');
    const chunks = splitForTelegram(longReport);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(3900);
    }
  });
});
