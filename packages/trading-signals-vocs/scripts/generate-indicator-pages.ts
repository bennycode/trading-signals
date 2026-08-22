/**
 * Generates one MDX page per indicator (all categories) plus the sidebar module consumed by
 * `vocs.config.ts`. Re-run after adding an indicator to `src/indicator-demos/<category>`:
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/generate-indicator-pages.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as tradingSignals from 'trading-signals';
import {categories, categoryMeta} from '../src/indicator-demos/registry.js';
import type {IndicatorConfig} from '../src/utils/types.js';

const indicatorsDir = path.join(import.meta.dirname, '../src/pages/indicators');
const introsDir = path.join(import.meta.dirname, '../src/intros');
const sidebarPath = path.join(import.meta.dirname, '../src/sidebar.generated.ts');

/** Hand-written prose from `src/intros/<category>/<id>.md`, preferred over the config's details. */
function readIntro(category: string, id: string): string | undefined {
  const introPath = path.join(introsDir, category, `${id}.md`);
  if (!fs.existsSync(introPath)) {
    return undefined;
  }
  return fs.readFileSync(introPath, 'utf8').trim();
}

/** Turns a class name into a variable name: all-caps stays lowercase (RSI → rsi), otherwise lower-camel. */
function toVariableName(className: string): string {
  if (className === className.toUpperCase()) {
    return className.toLowerCase();
  }
  return className.charAt(0).toLowerCase() + className.slice(1);
}

/**
 * Extracts the constructor arguments from a demo's `createIndicator` source, e.g.
 * `() => new RSIClass(14)` yields `14`. The demos alias their imports, so the class name comes
 * from the created instance instead.
 */
function extractConstructorArgs(config: IndicatorConfig): string | undefined {
  const source = config.createIndicator.toString();
  const match = /new\s+[A-Za-z_$][\w$]*\s*(\(?)/.exec(source);
  if (!match) {
    return undefined;
  }
  // `new Foo` without parens is how the transpiler prints zero-argument constructors.
  if (match[1] !== '(') {
    return '';
  }
  const start = match.index + match[0].length;
  let depth = 1;
  let position = start;
  while (position < source.length && depth > 0) {
    if (source[position] === '(') {
      depth += 1;
    } else if (source[position] === ')') {
      depth -= 1;
    }
    position += 1;
  }
  if (depth !== 0) {
    return undefined;
  }
  // The transpiled source drops spaces after commas and colons; restore them for readability.
  return source
    .slice(start, position - 1)
    .trim()
    .replace(/,(?=\S)/g, ', ')
    .replace(/:(?=\S)/g, ': ');
}

/** Twoslash-checked usage snippet, or undefined when the class is not a public trading-signals export. */
function buildUsageSnippet(config: IndicatorConfig): string | undefined {
  const className = config.createIndicator().constructor.name;
  if (!(className in tradingSignals)) {
    return undefined;
  }
  const args = extractConstructorArgs(config);
  if (args === undefined) {
    return undefined;
  }
  const variableName = toVariableName(className);
  // Constructor args may reference other public classes (e.g. MACD takes EMA instances).
  const referencedExports = [...new Set(args.match(/\b[A-Z][\w$]*\b/g) ?? [])].filter(
    name => name !== className && name in tradingSignals
  );
  const imports = [className, ...referencedExports].sort((a, b) => a.localeCompare(b));
  return `import {${imports.join(', ')}} from 'trading-signals';

// ${className} yields results once ${config.requiredInputs} inputs have been added
const ${variableName} = new ${className}(${args});`;
}

// Only category directories are wiped; hand-written pages under `indicators/` survive.
for (const {id: category} of categoryMeta) {
  fs.rmSync(path.join(indicatorsDir, category), {force: true, recursive: true});
}

let pageCount = 0;
let introCount = 0;
let usageCount = 0;
const sidebarSections: {items: {link: string; text: string}[]; text: string}[] = [];

for (const {id: category, title: categoryTitle} of categoryMeta) {
  const pagesDir = path.join(indicatorsDir, category);
  fs.mkdirSync(pagesDir, {recursive: true});

  for (const config of categories[category]) {
    const title = config.name === config.description ? config.name : `${config.description} (${config.name})`;
    const intro = readIntro(category, config.id);
    if (intro) {
      introCount += 1;
    }
    const lead = intro ?? config.details ?? config.description;
    const interval = config.createIndicator().interval ?? config.requiredInputs;
    const usage = buildUsageSnippet(config);
    if (usage) {
      usageCount += 1;
    }
    const page = `---
title: ${JSON.stringify(config.name)}
description: ${JSON.stringify(config.description)}
---

import {IndicatorPageDemo} from '../../../components/IndicatorPageDemo';

# ${title}

${lead}

## Live Demo

Pick a market regime to see how ${config.name}(${interval}) reacts:

<IndicatorPageDemo category=${JSON.stringify(category)} id=${JSON.stringify(config.id)} />
${
  usage
    ? `
## Usage

\`\`\`ts twoslash
${usage}
\`\`\`
`
    : ''
}`;
    fs.writeFileSync(path.join(pagesDir, `${config.id}.mdx`), page);
    pageCount += 1;
  }

  sidebarSections.push({
    items: categories[category]
      .map(config => ({link: `/indicators/${category}/${config.id}`, text: config.name}))
      .sort((a, b) => a.text.localeCompare(b.text)),
    text: categoryTitle,
  });
}

const sidebarModule = `// Generated by scripts/generate-indicator-pages.ts — do not edit by hand.
export const indicatorSidebar = ${JSON.stringify(sidebarSections, null, 2)};
`;
fs.writeFileSync(sidebarPath, sidebarModule);

console.log(
  `Generated ${pageCount} pages (${introCount} with intros, ${usageCount} with usage snippets) across ${categoryMeta.length} categories.`
);
