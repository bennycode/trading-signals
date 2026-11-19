/**
 * What the engine tells the user about its own bookkeeping, as opposed to about a trade. Each of
 * these is a thing that happened to the position without a rule asking for it, which is exactly
 * what someone watching a strategy cannot otherwise see.
 */
export const notices = {
  /** A holding that shrank without a fill of ours, so the thresholds now measure from less. */
  positionResized: (name: string, size: string) =>
    `${name}: the position is now ${size}, and its thresholds follow it.`,

  /** A short, which long-only rules can only make worse by acting on it. */
  shortHeld: (name: string) => `${name}: the account holds a short position, which these rules leave alone.`,

  /**
   * A saved snapshot this engine could not read. Starting fresh is safe — the position is adopted
   * from the balance again — but a percentage threshold then measures from the attach price
   * rather than from what was actually paid.
   */
  stateReset: (name: string) =>
    `${name}: the saved state could not be read and was reset. The position is adopted from the current ` +
    `balance, so a percentage threshold now measures from the price it attaches at.`,
};
