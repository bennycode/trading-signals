export interface MessageContext {
  /** Platform-prefixed sender ID, e.g. "telegram:123" */
  senderId: string;
  /** Platform identifier, e.g. "telegram" */
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
  /**
   * Broadcast an operator-facing alert (e.g. "WebSocket closed", "process restarted")
   * to every owner configured on this platform. Implementations should swallow per-recipient
   * errors so a single delivery failure doesn't block the rest — callers typically invoke
   * this from contexts (process shutdown, error handlers) where they can't recover anyway.
   */
  alertOperators(text: string): Promise<void>;
  registerCommand(name: string | string[], handler: CommandHandler): void;
  setReportScheduler?(scheduler: unknown): void;
  setWatchMonitor?(monitor: unknown): void;
  setStrategyMonitor?(monitor: unknown): void;
  /** List of registered command names (e.g., ["/help", "/price"]) */
  readonly commandList: string[];
  /** Platform-specific metadata for info commands */
  readonly platformInfo: PlatformInfo;
}
