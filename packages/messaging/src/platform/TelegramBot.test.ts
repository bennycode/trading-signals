import {describe, it, expect} from 'vitest';
import {TelegramBot} from './TelegramBot.js';

describe('TelegramBot', () => {
  describe('mdToHtml', () => {
    it('returns plain text unchanged', () => {
      expect(TelegramBot.mdToHtml('Hello world')).toBe('Hello world');
    });

    it('HTML-escapes ampersands', () => {
      expect(TelegramBot.mdToHtml('A & B')).toBe('A &amp; B');
    });

    it('HTML-escapes less-than and greater-than signs', () => {
      expect(TelegramBot.mdToHtml('<div>')).toBe('&lt;div&gt;');
    });

    it('converts *bold* to <b>bold</b>', () => {
      expect(TelegramBot.mdToHtml('*bold*')).toBe('<b>bold</b>');
    });

    it('converts _italic_ to <i>italic</i>', () => {
      expect(TelegramBot.mdToHtml('_italic_')).toBe('<i>italic</i>');
    });

    it('converts `code` to <code>code</code>', () => {
      expect(TelegramBot.mdToHtml('`code`')).toBe('<code>code</code>');
    });

    it('converts ```code block``` to <pre>code block</pre>', () => {
      expect(TelegramBot.mdToHtml('```\ncode block\n```')).toBe('<pre>\ncode block\n</pre>');
    });

    it('converts [link](url) to <a href="url">link</a>', () => {
      expect(TelegramBot.mdToHtml('[link](https://example.com)')).toBe(
        '<a href="https://example.com">link</a>'
      );
    });

    it('escapes HTML before converting markdown so user content cannot inject HTML', () => {
      expect(TelegramBot.mdToHtml('*<b>user</b>*')).toBe('<b>&lt;b&gt;user&lt;/b&gt;</b>');
    });

    it('handles account names with underscores without parse errors', () => {
      const accountName = 'my_account_name';
      const result = TelegramBot.mdToHtml(`Account: ${accountName}`);
      expect(result).toBe('Account: my_account_name');
    });
  });
});
