import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {loadEnvFiles} from './loadEnvFiles.js';

function createEnvFile(content: string): string {
  const path = join(tmpdir(), `loadEnvFiles-${randomUUID()}.env`);
  writeFileSync(path, content);
  return path;
}

describe('loadEnvFiles', () => {
  it('loads variables from an existing file', () => {
    const name = `TEST_${randomUUID().replaceAll('-', '')}`;
    const file = createEnvFile(`${name}=from-file\n`);

    loadEnvFiles(file);

    expect(process.env[name]).toBe('from-file');
  });

  it('never overrides a variable that already exists', () => {
    const name = `TEST_${randomUUID().replaceAll('-', '')}`;
    process.env[name] = 'from-environment';
    const file = createEnvFile(`${name}=from-file\n`);

    loadEnvFiles(file);

    expect(process.env[name], 'matches --env-file semantics: the environment wins').toBe('from-environment');
  });

  it('skips missing files and keeps loading the rest', () => {
    const name = `TEST_${randomUUID().replaceAll('-', '')}`;
    const file = createEnvFile(`${name}=from-file\n`);

    loadEnvFiles(join(tmpdir(), `missing-${randomUUID()}.env`), file);

    expect(process.env[name], 'a machine without one of the optional files still loads the others').toBe('from-file');
  });
});
