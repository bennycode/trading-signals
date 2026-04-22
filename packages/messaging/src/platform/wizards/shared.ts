import type {Context} from 'grammy';
import type {Conversation, ConversationFlavor} from '@grammyjs/conversations';

export type WizardContext = ConversationFlavor<Context>;
export type WizardConversation = Conversation<WizardContext, WizardContext>;

export interface InlineButton {
  text: string;
  callback_data: string;
}

export function inlineKeyboard(rows: InlineButton[][]) {
  return {reply_markup: {inline_keyboard: rows}};
}

export const ACCOUNT_ADD_WIZARD_ID = 'accountAdd';
export const WATCH_ADD_WIZARD_ID = 'watchAdd';
export const STRATEGY_ADD_WIZARD_ID = 'strategyAdd';

/**
 * Waits for a text message. If the user sends a `/command` instead of the
 * expected text input, the wizard is cancelled cleanly and `cancelled: true`
 * is returned so the caller can `return` immediately. Alpaca API keys / pairs
 * / JSON configs never legitimately start with `/`, so this heuristic is safe
 * in practice.
 */
export async function waitForTextOrCancel(
  conversation: WizardConversation,
  ctx: WizardContext
): Promise<{text: string; cancelled: boolean}> {
  const msgCtx = await conversation.waitFor('message:text');
  const text = msgCtx.msg.text.trim();
  if (text.startsWith('/')) {
    const isExplicitCancel = text.toLowerCase().startsWith('/cancel');
    await ctx.reply(
      isExplicitCancel
        ? 'Cancelled.'
        : 'Wizard cancelled. Resend your command to start fresh.'
    );
    return {text: '', cancelled: true};
  }
  return {text, cancelled: false};
}
