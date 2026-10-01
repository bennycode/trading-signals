import type {Context} from 'grammy';

/**
 * Rewrites the bot_command entity at offset 0 to lowercase so grammY's
 * case-sensitive command matching accepts any casing from the user. Only
 * the command name is lowercased — the optional `@botname` suffix and any
 * arguments after the command are left untouched.
 */
export async function lowercaseCommandMiddleware(ctx: Context, next: () => Promise<void>): Promise<void> {
  const message = ctx.message ?? ctx.channelPost;
  const text = message?.text;
  const entities = message?.entities;
  if (text && entities) {
    const entity = entities.find(e => e.type === 'bot_command' && e.offset === 0);
    if (entity) {
      const rawCommand = text.slice(0, entity.length);
      const atIndex = rawCommand.indexOf('@');
      const nameEnd = atIndex === -1 ? rawCommand.length : atIndex;
      const normalized = rawCommand.slice(0, nameEnd).toLowerCase() + rawCommand.slice(nameEnd);
      if (normalized !== rawCommand) {
        (message as {text: string}).text = normalized + text.slice(entity.length);
      }
    }
  }
  await next();
}
