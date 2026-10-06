import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseEnv} from 'node:util';

/*
 * Keeps secrets and flags apart. `.env.op` may only reference 1Password, so no secret ever lands in
 * the repository as a plain value, and `.env.flags` may never reference it, because `op run` masks
 * every output that matches a resolved value and a flag like "true" would hide every "true" in logs.
 */
const root = resolve(import.meta.dirname, '..');
const read = (file: string) => parseEnv(readFileSync(resolve(root, file), 'utf8'));
const isReference = (value: string | undefined) => value?.startsWith('op://') === true;

const problems = [
  ...Object.entries(read('.env.op'))
    .filter(([, value]) => !isReference(value))
    .map(([name]) => `.env.op: "${name}" must be an op:// reference, plain values belong in .env.flags.`),
  ...Object.entries(read('.env.flags'))
    .filter(([, value]) => isReference(value))
    .map(([name]) => `.env.flags: "${name}" references 1Password, secrets belong in .env.op.`),
];

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
