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
