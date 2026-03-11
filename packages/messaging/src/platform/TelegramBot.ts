export class TelegramBot {
  /**
   * Converts Telegram Markdown text to HTML suitable for Telegram's HTML parse mode.
   * HTML-escapes user-supplied content to prevent parse errors and injection.
   */
  static mdToHtml(text: string): string {
    // HTML-escape special characters first to prevent HTML injection
    let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Convert Telegram Markdown to HTML (pre-formatted blocks before inline code)
    html = html.replace(/```(?:\w+\n)?([\s\S]*?)```/g, '<pre>$1</pre>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*([^*\n]+)\*/g, '<b>$1</b>');
    html = html.replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, '<i>$1</i>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    return html;
  }
}
