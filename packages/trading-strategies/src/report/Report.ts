export abstract class Report {
  static NAME: string;

  readonly config: Record<string, unknown>;

  constructor(config: Record<string, unknown>) {
    this.config = config;
  }

  /**
   * Execute the report and return a formatted string result
   * suitable for sending as a chat message.
   */
  abstract run(): Promise<string>;
}
