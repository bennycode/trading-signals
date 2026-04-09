/**
 * Sentinel string that reports can insert between sections to force the
 * messaging layer to deliver them as separate messages. Uses the ASCII form-feed
 * character (U+000C) because it never appears in natural report text.
 *
 * Messaging platforms that don't care about message boundaries can safely
 * treat it as a paragraph separator or strip it.
 */
export const MESSAGE_BREAK = '\f';

export abstract class Report<T extends Record<string, unknown> = Record<string, unknown>> {
  static NAME: string;

  readonly config: T;

  constructor(config: T) {
    this.config = config;
  }

  /**
   * Execute the report and return a formatted string result
   * suitable for sending as a chat message.
   *
   * To deliver a report as multiple messages, separate sections with
   * {@link MESSAGE_BREAK}.
   */
  abstract run(): Promise<string>;
}
