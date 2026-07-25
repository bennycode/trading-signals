import {defineConfig} from 'oxfmt';

/**
 * Formatting for every file type in the monorepo, code included. Oxfmt discovers this file from
 * any package directory and honours `.gitignore`, so the per-package scripts need no arguments.
 */
export default defineConfig({
  arrowParens: 'avoid',
  bracketSameLine: true,
  bracketSpacing: false,
  printWidth: 120,
  proseWrap: 'never',
  semi: true,
  singleQuote: true,
  /*
   * Several packages group their scripts by purpose rather than alphabetically. Sorting would
   * reshuffle every `package.json` in the repo for no benefit.
   */
  sortPackageJson: false,
  tabWidth: 2,
  trailingComma: 'es5',
  useTabs: false,
});
