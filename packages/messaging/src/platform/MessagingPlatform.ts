import type {ReportAttributes} from '../database/models/Report.js';
import type {StrategyAttributes} from '../database/models/Strategy.js';
import type {WatchAttributes} from '../database/models/Watch.js';

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

/*
 * Ports: the narrow, platform-facing slice of a backend service. A platform's
 * interactive flows may need to activate what they just persisted (schedule a
 * report, subscribe a watch/strategy, restart sessions after a credentials
 * edit), but they must not reach into service internals — these interfaces
 * pin down exactly what a platform is allowed to drive.
 */

export interface ReportSchedulerPort {
  scheduleReport(row: ReportAttributes, options?: {runImmediately?: boolean}): void;
}

export interface WatchMonitorPort {
  restartForAccount(accountId: number): Promise<void>;
  subscribeToWatch(watch: WatchAttributes): Promise<void>;
}

export interface StrategyMonitorPort {
  restartForAccount(accountId: number): Promise<void>;
  subscribeToStrategy(row: StrategyAttributes): Promise<void>;
}

export interface MessagingPlatform {
  start(): Promise<void>;
  stop(): Promise<void>;
  sendMessage(userId: string, text: string): Promise<void>;
  registerCommand(name: string | string[], handler: CommandHandler): void;
  /*
   * Optional setter injection: the monitors are constructed after the
   * platforms (they need the PlatformDispatcher, which needs the platforms),
   * so they cannot be constructor arguments. Platforms without interactive
   * flows that activate services simply omit these.
   */
  setReportScheduler?(scheduler: ReportSchedulerPort): void;
  setWatchMonitor?(monitor: WatchMonitorPort): void;
  setStrategyMonitor?(monitor: StrategyMonitorPort): void;
  /** List of registered command names (e.g., ["/help", "/price"]) */
  readonly commandList: string[];
  /** Platform-specific metadata for info commands */
  readonly platformInfo: PlatformInfo;
}
