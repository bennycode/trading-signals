import readline from 'node:readline';
import {SMA} from '../index.js';

export async function* keyboardStream() {
  const KEY_CTRL_C = '\u0003';

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase() === KEY_CTRL_C) {
      rl.close();
      break;
    }

    const input = parseFloat(trimmed);
    if (isNaN(input)) {
      console.log(`Invalid input: ${trimmed}`);
    } else {
      yield input;
    }
  }
}

const sma = new SMA(3);

console.log(`Type in some numbers and press "Enter" to calculate SMA (${sma.interval}).\nPress "Ctrl+C" to exit.`);

for await (const value of keyboardStream()) {
  sma.add(value);

  if (sma.isStable) {
    console.log(`SMA (${sma.interval}): ${sma.getResultOrThrow().toFixed(2)}`);
  } else {
    console.log(`Need more data...`);
  }
}
