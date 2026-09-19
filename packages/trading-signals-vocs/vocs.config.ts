import {createRequire} from 'node:module';
import * as path from 'node:path';
import {defineConfig} from 'vocs/config';
import {indicatorSidebar} from './src/sidebar.generated';

const require = createRequire(import.meta.url);

export default defineConfig({
  description: 'Technical indicators and overlays to run technical analysis with JavaScript & TypeScript',
  renderStrategy: 'full-static',
  sidebar: [
    {
      link: '/',
      text: 'Getting Started',
    },
    ...indicatorSidebar.map(section => ({
      collapsed: true,
      items: section.items,
      text: section.text,
    })),
    {
      link: '/indicators/utilities',
      text: 'Utility Functions',
    },
    {
      link: '/backtest',
      text: 'Backtesting',
    },
  ],
  title: 'Typed Trader',
  twoslash: {
    twoslashOptions: {
      /*
       * The monorepo root pins TypeScript 7 (native, no JS API and no lib.*.d.ts files), which
       * Twoslash cannot use. This package pins TypeScript 5 locally, and Twoslash needs to be
       * pointed at its lib directory explicitly so @typescript/vfs finds the default libs.
       */
      tsLibDirectory: path.dirname(require.resolve('typescript')),
    },
  },
});
