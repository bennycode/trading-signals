export function getStreaks(prices: number[], side: 'up' | 'down') {
  const streaks: number[] = [];
  let currentStreak = 0;

  for (let i = 1; i < prices.length; i++) {
    const isUpward = side === 'up' && prices[i] > prices[i - 1];
    const isDownward = side === 'down' && prices[i] < prices[i - 1];
    if (isUpward || isDownward) {
      currentStreak++;
    } else {
      // Save the streak if it ends
      if (currentStreak > 0) {
        streaks.push(currentStreak);
      }
      // Reset the streak
      currentStreak = 0;
    }
  }

  // Append the final streak if it exists
  if (currentStreak > 0) {
    streaks.push(currentStreak);
  }

  return streaks;
}
