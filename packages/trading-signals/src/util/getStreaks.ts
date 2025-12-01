export type Streak = {
  /** Length of the streak */
  length: number;
  /** Price change percentage during the streak */
  percentage: number;
};

/**
 * Tracks the lengths (streaks) of continuous price movements (up or down).
 *
 * @param prices A series of prices
 * @param keepSide If you want to receive only uptrends or downtrends
 * @returns An array of objects representing the filtered streaks
 */
export function getStreaks(prices: number[], keepSide: 'up' | 'down'): Streak[] {
  const streaks: Streak[] = [];
  let currentStreak = 0;

  function saveStreak(i: number) {
    const endPrice = prices[i - 1];
    const startPrice = prices[i - currentStreak - 1];
    const percentage = ((endPrice - startPrice) / startPrice) * 100;
    streaks.push({length: currentStreak, percentage});
  }

  for (let i = 1; i < prices.length; i++) {
    const isUpward = keepSide === 'up' && prices[i] > prices[i - 1];
    const isDownward = keepSide === 'down' && prices[i] < prices[i - 1];
    if (isUpward || isDownward) {
      currentStreak++;
    } else {
      // Save the streak if it ends
      if (currentStreak > 0) {
        saveStreak(i);
      }
      // Reset the streak
      currentStreak = 0;
    }
  }

  // Append the final streak if it exists
  if (currentStreak > 0) {
    saveStreak(prices.length);
  }

  return streaks;
}
