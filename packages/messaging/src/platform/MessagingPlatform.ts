export interface MessageContext {
  /** Platform-prefixed sender ID, e.g. "xmtp:0x..." or "telegram:123" */
  senderId: string;
  /** Platform identifier: "xmtp" or "telegram" */
  platformId: string;
  /** Message text after command name */
  content: string;
  /** Reply with Markdown */
  reply(text: string): Promise<void>;
}

export type CommandHandler = (ctx: MessageContext) => Promise<void>;

export interface PlatformInfo {
  /** The bot's own address/username on this platform */
  botAddress: string;
  /** SDK/library version string */
  sdkVersion: string;
}

export interface MessagingPlatform {
  start(): Promise<void>;
  stop(): Promise<void>;
  sendMessage(userId: string, text: string): Promise<void>;
  registerCommand(name: string | string[], handler: CommandHandler): void;
  /** List of registered command names (e.g., ["/help", "/price"]) */
  readonly commandList: string[];
  /** Platform-specific metadata for info commands */
  readonly platformInfo: PlatformInfo;
}
