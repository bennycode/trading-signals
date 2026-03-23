export abstract class Report<T extends Record<string, unknown> = Record<string, unknown>> {
  static NAME: string;

  readonly config: T;

  constructor(config: T) {
    this.config = config;
  }

  /**
   * Execute the report and return a formatted string result
   * suitable for sending as a chat message.
   */
  abstract run(): Promise<string>;
}
