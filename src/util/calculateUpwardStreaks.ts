export function calculateUpwardStreaks(prices: number[]) {
  const streaks: number[] = [];
  let currentStreak = 0;

  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > prices[i - 1]) {
      // Increment streak if the current price is higher
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
