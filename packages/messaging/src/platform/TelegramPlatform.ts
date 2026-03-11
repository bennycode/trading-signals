import {Telegraf} from 'telegraf';
import type {CommandHandler, MessageContext, MessagingPlatform, PlatformInfo} from './MessagingPlatform.js';

const PLATFORM_PREFIX = 'telegram:';

function mdToHtml(text: string): string {
  return (
    text
      // Code blocks (triple backticks)
      .replace(/```([\s\S]*?)```/g, '<pre>$1</pre>')
      // Inline code (single backticks)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Bold (**text** or __text__)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/__(.+?)__/g, '<b>$1</b>')
      // Italic (*text* or _text_)
      .replace(/\*(.+?)\*/g, '<i>$1</i>')
      .replace(/_(.+?)_/g, '<i>$1</i>')
  );
}

export class TelegramPlatform implements MessagingPlatform {
  #bot: Telegraf;
  #ownerIds: string[];
  #commands: Map<string, CommandHandler> = new Map();
  #platformInfo: PlatformInfo = {botAddress: '', sdkVersion: ''};

  constructor(botToken: string, ownerIds?: string) {
    this.#bot = new Telegraf(botToken);
    this.#ownerIds = ownerIds ? ownerIds.split(',').map(id => id.trim()) : [];
  }

  registerCommand(name: string, handler: CommandHandler): void {
    this.#commands.set(name, handler);

    this.#bot.command(name, async ctx => {
      const senderId = ctx.from?.id?.toString();

      if (!senderId) {
        await ctx.reply('Unable to determine sender');
        return;
      }

      if (this.#ownerIds.length > 0 && !this.#ownerIds.includes(senderId)) {
        console.warn(
          `Ignoring Telegram message from "${senderId}" - only messages from owners [${this.#ownerIds.join(', ')}] are processed.`
        );
        return;
      }

      // Extract text after the /command
      const text = ctx.message.text;
      const commandEnd = text.indexOf(' ');
      const content = commandEnd === -1 ? '' : text.slice(commandEnd + 1);

      const messageCtx: MessageContext = {
        senderId: `${PLATFORM_PREFIX}${senderId}`,
        platformId: 'telegram',
        content,
        reply: async (replyText: string) => {
          const html = mdToHtml(replyText);
          await ctx.reply(html, {parse_mode: 'HTML'});
        },
      };

      await handler(messageCtx);
    });
  }

  async start(): Promise<void> {
    if (this.#ownerIds.length > 0) {
      console.log(`Only Telegram user IDs (${this.#ownerIds.join(', ')}) can message the bot.`);
    } else {
      console.warn('Warning: TELEGRAM_OWNER_IDS is not set. Everyone can message the bot via Telegram.');
    }

    await this.#bot.launch();

    const botInfo = await this.#bot.telegram.getMe();
    this.#platformInfo = {
      botAddress: `@${botInfo.username}`,
      sdkVersion: 'Telegraf',
    };

    console.log(`Telegram bot started as ${this.#platformInfo.botAddress}.`);
  }

  async stop(): Promise<void> {
    this.#bot.stop();
  }

  async sendMessage(userId: string, text: string): Promise<void> {
    const chatId = userId.replace(PLATFORM_PREFIX, '');
    const html = mdToHtml(text);
    await this.#bot.telegram.sendMessage(chatId, html, {parse_mode: 'HTML'});
  }

  get commandList(): string[] {
    return Array.from(this.#commands.keys()).map(cmd => `/${cmd}`);
  }

  get platformInfo(): PlatformInfo {
    return this.#platformInfo;
  }
}
