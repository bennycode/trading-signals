import readline from 'node:readline';
import {SMA} from './index.js';

process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
process.stdin.resume();

const KEY_BACKSPACE = '\u007F';
const KEY_CTRL_C = '\u0003';

const sma = new SMA(3);
let buffer = '';

console.log('Type in some numbers and press Enter (Ctrl+C to exit):');

process.stdin.on('data', (key: string) => {
  if (key === KEY_CTRL_C) {
    console.log('\nExiting...');
    process.exit(0);
  }

  if (key === '\r' || key === '\n') {
    const num = parseFloat(buffer);
    if (!isNaN(num)) {
      sma.add(num);
      if (sma.isStable) {
        console.log(`\nSMA: ${sma.getResultOrThrow().toFixed(2)}`);
      } else {
        console.log(`\nNot enough data for SMA yet.`);
      }
    } else {
      console.log(`\nInvalid number: ${buffer}`);
    }
    buffer = '';
    return;
  }

  if (key === KEY_BACKSPACE) {
    buffer = buffer.slice(0, -1);
    process.stdout.write('\b \b');
  } else {
    buffer += key;
    process.stdout.write(key);
  }
});

export async function* keyboardNumberStream(): AsyncGenerator<number> {
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

    const num = parseFloat(trimmed);
    if (isNaN(num)) {
      console.log(`Invalid input: "${trimmed}"`);
    } else {
      yield num;
    }
  }
}
