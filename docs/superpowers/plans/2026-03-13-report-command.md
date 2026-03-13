# Report Command Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/report` command system to the messenger that lets users register, run, list, and remove named reports (like `ranksp500`) with per-report configuration (like API keys), supporting one-shot execution and optional cron scheduling.

**Architecture:** Mirror the strategy pattern: a `Report` base class and `ReportRegistry` in `trading-strategies`, a `reports` table in `messaging`, and `reportAdd`/`reportRun`/`reportList`/`reportRemove` command handlers. Reports are one-shot by default; an optional cron expression persisted in the DB enables scheduled execution via a `ReportScheduler` service. The existing `rankSP500Momentum.ts` script is refactored into the first `Report` implementation.

**Tech Stack:** TypeScript, ESM, Zod, Drizzle ORM, SQLite, node-cron, Vitest

---

## Chunk 1: Report Base Class & Registry (in `trading-strategies`)

### Task 1: Create Report base class

**Files:**
- Create: `packages/trading-strategies/src/report/Report.ts`
- Test: `packages/trading-strategies/src/report/Report.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/trading-strategies/src/report/Report.test.ts
import {describe, expect, it} from 'vitest';
import {Report} from './Report.js';

class TestReport extends Report {
  static override NAME = 'test-report';

  async run(): Promise<string> {
    const greeting = this.config.greeting as string;
    return `Hello, ${greeting}!`;
  }
}

describe('Report', () => {
  it('stores config and runs', async () => {
    const report = new TestReport({greeting: 'world'});
    const result = await report.run();
    expect(result).toBe('Hello, world!');
  });

  it('exposes config as readonly', () => {
    const report = new TestReport({key: 'value'});
    expect(report.config).toEqual({key: 'value'});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/trading-strategies && npx vitest run src/report/Report.test.ts`
Expected: FAIL — cannot resolve `./Report.js`

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/trading-strategies/src/report/Report.ts
export abstract class Report {
  static NAME: string;

  readonly config: Record<string, unknown>;

  constructor(config: Record<string, unknown>) {
    this.config = config;
  }

  /**
   * Execute the report and return a formatted string result
   * suitable for sending as a chat message.
   */
  abstract run(): Promise<string>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/trading-strategies && npx vitest run src/report/Report.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/trading-strategies/src/report/Report.ts packages/trading-strategies/src/report/Report.test.ts
git commit -m "feat(report): add Report base class"
```

---

### Task 2: Refactor rankSP500Momentum into SP500MomentumReport

**Files:**
- Create: `packages/trading-strategies/src/report-sp500-momentum/SP500MomentumReport.ts`
- Move: `packages/trading-strategies/src/momentum-ranking/sp500Tickers.ts` → `packages/trading-strategies/src/report-sp500-momentum/sp500Tickers.ts`
- Delete: `packages/trading-strategies/src/momentum-ranking/rankSP500Momentum.ts`
- Test: `packages/trading-strategies/src/report-sp500-momentum/SP500MomentumReport.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/trading-strategies/src/report-sp500-momentum/SP500MomentumReport.test.ts
import {describe, expect, it} from 'vitest';
import {SP500MomentumReport, SP500MomentumSchema} from './SP500MomentumReport.js';

describe('SP500MomentumReport', () => {
  it('has the correct NAME', () => {
    expect(SP500MomentumReport.NAME).toBe('@typedtrader/report-sp500-momentum');
  });

  it('validates config with Zod schema', () => {
    const parsed = SP500MomentumSchema.parse({apiKey: 'test-key'});
    expect(parsed.apiKey).toBe('test-key');
  });

  it('rejects config without apiKey', () => {
    expect(() => SP500MomentumSchema.parse({})).toThrow();
  });

  it('stores config from constructor', () => {
    const config = SP500MomentumSchema.parse({apiKey: 'my-key'});
    const report = new SP500MomentumReport(config);
    expect(report.config.apiKey).toBe('my-key');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/trading-strategies && npx vitest run src/report-sp500-momentum/SP500MomentumReport.test.ts`
Expected: FAIL — cannot resolve `./SP500MomentumReport.js`

- [ ] **Step 3: Install `@massive.com/client-js` dependency and move files**

```bash
cd packages/trading-strategies && npm install @massive.com/client-js
mkdir -p packages/trading-strategies/src/report-sp500-momentum
mv packages/trading-strategies/src/momentum-ranking/sp500Tickers.ts packages/trading-strategies/src/report-sp500-momentum/sp500Tickers.ts
```

- [ ] **Step 4: Write implementation**

```typescript
// packages/trading-strategies/src/report-sp500-momentum/SP500MomentumReport.ts
import {z} from 'zod';
import {restClient} from '@massive.com/client-js';
import {Report} from '../report/Report.js';
import {SP500_TICKERS} from './sp500Tickers.js';

export const SP500MomentumSchema = z.object({
  apiKey: z.string().min(1),
});

export type SP500MomentumConfig = z.infer<typeof SP500MomentumSchema>;

interface MomentumResult {
  ticker: string;
  priceNow: number;
  price12MonthsAgo: number;
  returnPct: number;
}

interface Bar {
  T?: string;
  c?: number;
}

function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function findLastTradingDay(date: Date): Date {
  const day = date.getDay();
  if (day === 0) date.setDate(date.getDate() - 2);
  if (day === 6) date.setDate(date.getDate() - 1);
  return date;
}

export class SP500MomentumReport extends Report {
  static override NAME = '@typedtrader/report-sp500-momentum';

  constructor(config: SP500MomentumConfig) {
    super(config);
  }

  async run(): Promise<string> {
    const rest = restClient(this.config.apiKey as string);

    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

    const recentDate = findLastTradingDay(new Date(now.getTime() - 86_400_000));
    const pastDate = findLastTradingDay(twelveMonthsAgo);

    const toDate = getDateString(recentDate);
    const fromDate = getDateString(pastDate);

    const [currentPrices, pastPrices] = await Promise.all([
      this.#getClosingPrices(rest, toDate),
      this.#getClosingPrices(rest, fromDate),
    ]);

    const results: MomentumResult[] = [];

    for (const ticker of SP500_TICKERS) {
      const priceNow = currentPrices.get(ticker);
      const priceThen = pastPrices.get(ticker);
      if (priceNow != null && priceThen != null && priceThen > 0) {
        results.push({
          ticker,
          priceNow,
          price12MonthsAgo: priceThen,
          returnPct: ((priceNow - priceThen) / priceThen) * 100,
        });
      }
    }

    results.sort((a, b) => b.returnPct - a.returnPct);

    return this.#formatResults(results, fromDate, toDate);
  }

  async #getClosingPrices(rest: ReturnType<typeof restClient>, date: string): Promise<Map<string, number>> {
    const response = await rest.getGroupedStocksAggregates({date});
    const bars: Bar[] = response.results ?? [];
    const prices = new Map<string, number>();
    for (const bar of bars) {
      if (bar.T && bar.c != null) {
        prices.set(bar.T, bar.c);
      }
    }
    return prices;
  }

  #formatResults(results: MomentumResult[], fromDate: string, toDate: string): string {
    const top = 20;
    const lines: string[] = [];

    lines.push(`S&P 500 Momentum: ${fromDate} → ${toDate}`);
    lines.push('');
    lines.push(`**Top ${top} Winners (12m return)**`);
    lines.push('```');
    lines.push('Rank  Ticker     12m Return    Price Now    Price 12m Ago');
    lines.push('----  ------     ----------    ---------    -------------');

    for (let i = 0; i < Math.min(top, results.length); i++) {
      const r = results[i];
      lines.push(
        `${String(i + 1).padStart(4)}  ${r.ticker.padEnd(10)} ${r.returnPct.toFixed(2).padStart(9)}%    $${r.priceNow.toFixed(2).padStart(8)}    $${r.price12MonthsAgo.toFixed(2).padStart(8)}`
      );
    }
    lines.push('```');

    lines.push('');
    lines.push(`**Bottom ${top} Losers (12m return)**`);
    lines.push('```');
    lines.push('Rank  Ticker     12m Return    Price Now    Price 12m Ago');
    lines.push('----  ------     ----------    ---------    -------------');

    const bottom = results.slice(-top).reverse();
    for (let i = 0; i < bottom.length; i++) {
      const r = bottom[i];
      lines.push(
        `${String(i + 1).padStart(4)}  ${r.ticker.padEnd(10)} ${r.returnPct.toFixed(2).padStart(9)}%    $${r.priceNow.toFixed(2).padStart(8)}    $${r.price12MonthsAgo.toFixed(2).padStart(8)}`
      );
    }
    lines.push('```');

    lines.push('');
    lines.push(`Stocks ranked: ${results.length} / ${SP500_TICKERS.length}`);

    return lines.join('\n');
  }
}
```

- [ ] **Step 5: Delete old standalone script**

```bash
rm packages/trading-strategies/src/momentum-ranking/rankSP500Momentum.ts
rmdir packages/trading-strategies/src/momentum-ranking 2>/dev/null || true
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd packages/trading-strategies && npx vitest run src/report-sp500-momentum/SP500MomentumReport.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/trading-strategies/package.json package-lock.json packages/trading-strategies/src/report-sp500-momentum/ packages/trading-strategies/src/momentum-ranking/
git commit -m "feat(report): refactor rankSP500Momentum into SP500MomentumReport class"
```

---

### Task 3: Create ReportRegistry

**Files:**
- Create: `packages/trading-strategies/src/report/ReportRegistry.ts`
- Test: `packages/trading-strategies/src/report/ReportRegistry.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/trading-strategies/src/report/ReportRegistry.test.ts
import {describe, expect, it} from 'vitest';
import {createReport, getReportNames} from './ReportRegistry.js';

describe('ReportRegistry', () => {
  it('lists available report names', () => {
    const names = getReportNames();
    expect(names).toContain('@typedtrader/report-sp500-momentum');
  });

  it('creates a report by name with config', () => {
    const report = createReport('@typedtrader/report-sp500-momentum', {apiKey: 'test-key'});
    expect(report).toBeDefined();
    expect(report.config.apiKey).toBe('test-key');
  });

  it('throws for unknown report name', () => {
    expect(() => createReport('nonexistent', {})).toThrow('Unknown report');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/trading-strategies && npx vitest run src/report/ReportRegistry.test.ts`
Expected: FAIL — cannot resolve `./ReportRegistry.js`

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/trading-strategies/src/report/ReportRegistry.ts
import type {z} from 'zod';
import type {Report} from './Report.js';
import {SP500MomentumReport, SP500MomentumSchema} from '../report-sp500-momentum/SP500MomentumReport.js';

interface ReportEntry {
  create: (config: unknown) => Report;
  schema: z.ZodType;
}

const registry: Record<string, ReportEntry> = {
  [SP500MomentumReport.NAME]: {
    create: (config: unknown) => new SP500MomentumReport(SP500MomentumSchema.parse(config)),
    schema: SP500MomentumSchema,
  },
};

export function createReport(name: string, config: unknown): Report {
  const entry = registry[name];
  if (!entry) {
    throw new Error(`Unknown report "${name}". Available: ${getReportNames().join(', ')}`);
  }
  return entry.create(config);
}

export function getReportNames(): string[] {
  return Object.keys(registry);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/trading-strategies && npx vitest run src/report/ReportRegistry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/trading-strategies/src/report/ReportRegistry.ts packages/trading-strategies/src/report/ReportRegistry.test.ts
git commit -m "feat(report): add ReportRegistry with factory pattern"
```

---

### Task 4: Export report module from trading-strategies

**Files:**
- Create: `packages/trading-strategies/src/report/index.ts`
- Modify: `packages/trading-strategies/src/index.ts`

- [ ] **Step 1: Create report barrel export**

```typescript
// packages/trading-strategies/src/report/index.ts
export * from './Report.js';
export * from './ReportRegistry.js';
```

- [ ] **Step 2: Add report exports to package index**

Add to `packages/trading-strategies/src/index.ts`:

```typescript
export * from './report/index.js';
export {SP500MomentumReport, SP500MomentumSchema, type SP500MomentumConfig} from './report-sp500-momentum/SP500MomentumReport.js';
```

- [ ] **Step 3: Verify build**

Run: `cd packages/trading-strategies && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/trading-strategies/src/report/index.ts packages/trading-strategies/src/index.ts
git commit -m "feat(report): export report module from trading-strategies"
```

---

## Chunk 2: Database & Messaging Commands

### Task 5: Add `reports` table to database schema

**Files:**
- Modify: `packages/messaging/src/database/schema.ts`

- [ ] **Step 1: Add reports table to schema**

Add to `packages/messaging/src/database/schema.ts` after the `strategies` table:

```typescript
export const reports = sqliteTable('reports', {
  id: integer('id').primaryKey({autoIncrement: true}),
  userId: text('userId').notNull(),
  reportName: text('reportName').notNull(),
  config: text('config').notNull(),
  cron: text('cron'),
  createdAt: text('createdAt').default(sql`(CURRENT_TIMESTAMP)`),
});

export type ReportRow = typeof reports.$inferSelect;
export type NewReportRow = typeof reports.$inferInsert;
```

> **Design note:** Unlike strategies, reports don't need an `accountId` (they don't trade). They store `userId` directly so the system knows who to send results to. The `cron` column is nullable — `null` means one-shot only.

- [ ] **Step 2: Generate migration**

Run: `cd packages/messaging && npx drizzle-kit generate`
Expected: A new migration file is created in `migrations/`

- [ ] **Step 3: Verify migration SQL**

Read the generated migration file. It should contain:

```sql
CREATE TABLE `reports` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `userId` text NOT NULL,
  `reportName` text NOT NULL,
  `config` text NOT NULL,
  `cron` text,
  `createdAt` text DEFAULT (CURRENT_TIMESTAMP)
);
```

- [ ] **Step 4: Commit**

```bash
git add packages/messaging/src/database/schema.ts packages/messaging/migrations/
git commit -m "feat(report): add reports table to database schema"
```

---

### Task 6: Create Report database model

**Files:**
- Create: `packages/messaging/src/database/models/Report.ts`

- [ ] **Step 1: Write the model**

```typescript
// packages/messaging/src/database/models/Report.ts
import {eq, asc, isNotNull} from 'drizzle-orm';
import {db} from '../initializeDatabase.js';
import {reports, type ReportRow, type NewReportRow} from '../schema.js';

export type ReportAttributes = ReportRow;
export type ReportCreationAttributes = Omit<NewReportRow, 'id' | 'createdAt'>;

export class Report {
  static create(data: ReportCreationAttributes): ReportRow {
    return db.insert(reports).values(data).returning().get();
  }

  static findByPk(id: number): ReportRow | undefined {
    return db.select().from(reports).where(eq(reports.id, id)).get();
  }

  static findByUserId(userId: string): ReportRow[] {
    return db
      .select()
      .from(reports)
      .where(eq(reports.userId, userId))
      .orderBy(asc(reports.id))
      .all();
  }

  static findAllWithCron(): ReportRow[] {
    return db
      .select()
      .from(reports)
      .where(isNotNull(reports.cron))
      .orderBy(asc(reports.id))
      .all();
  }

  static destroy(id: number): void {
    db.delete(reports).where(eq(reports.id, id)).run();
  }
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd packages/messaging && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/messaging/src/database/models/Report.ts
git commit -m "feat(report): add Report database model"
```

---

### Task 7: Create reportAdd command

**Files:**
- Create: `packages/messaging/src/command/report/reportAdd.ts`

- [ ] **Step 1: Write the command handler**

```typescript
// packages/messaging/src/command/report/reportAdd.ts
import {getReportNames, createReport} from 'trading-strategies';
import {Report} from '../../database/models/Report.js';
import type {ReportAttributes} from '../../database/models/Report.js';

export interface ReportAddResult {
  message: string;
  report?: ReportAttributes;
}

// Format: "<reportName> [configJSON] [--cron <expression>]"
// Example: "/reportAdd @typedtrader/report-sp500-momentum {"apiKey":"abc123"}"
// Example: "/reportAdd @typedtrader/report-sp500-momentum {"apiKey":"abc123"} --cron 0 9 * * 1"
export const reportAdd = async (request: string, userId: string): Promise<ReportAddResult> => {
  const cronFlagIndex = request.indexOf(' --cron ');
  let mainPart: string;
  let cron: string | null = null;

  if (cronFlagIndex !== -1) {
    mainPart = request.slice(0, cronFlagIndex).trim();
    cron = request.slice(cronFlagIndex + ' --cron '.length).trim();
    if (!cron) {
      return {message: 'Missing cron expression after --cron flag.'};
    }
  } else {
    mainPart = request.trim();
  }

  const spaceIndex = mainPart.indexOf(' ');
  let reportName: string;
  let configJson: string;

  if (spaceIndex === -1) {
    reportName = mainPart;
    configJson = '{}';
  } else {
    reportName = mainPart.slice(0, spaceIndex);
    configJson = mainPart.slice(spaceIndex + 1).trim() || '{}';
  }

  if (!reportName) {
    return {
      message: `Invalid format. Usage: /reportAdd <reportName> [configJSON] [--cron <expression>]\nAvailable reports: ${getReportNames().join(', ')}`,
    };
  }

  let config: unknown;
  try {
    config = JSON.parse(configJson);
  } catch {
    return {message: 'Invalid config JSON. Provide valid JSON or omit for default config.'};
  }

  try {
    // Validate report name and config by attempting to create it
    createReport(reportName, config);

    const row = Report.create({
      userId,
      reportName,
      config: configJson,
      cron,
    });

    let message = `Report created (ID: ${row.id})\nReport: ${reportName}`;
    if (cron) {
      message += `\nSchedule: ${cron}`;
    } else {
      message += `\nSchedule: one-shot (use /reportRun ${row.id} to execute)`;
    }

    return {message, report: row};
  } catch (error) {
    if (error instanceof Error) {
      return {message: `Error creating report: ${error.message}`};
    }
    return {message: 'Error creating report'};
  }
};
```

- [ ] **Step 2: Verify types compile**

Run: `cd packages/messaging && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/messaging/src/command/report/reportAdd.ts
git commit -m "feat(report): add reportAdd command handler"
```

---

### Task 8: Create reportRun command

**Files:**
- Create: `packages/messaging/src/command/report/reportRun.ts`

- [ ] **Step 1: Write the command handler**

```typescript
// packages/messaging/src/command/report/reportRun.ts
import {createReport} from 'trading-strategies';
import {Report} from '../../database/models/Report.js';
import {assertId} from '../../validation/assertId.js';

// Format: "<reportId>"
// Example: "/reportRun 3"
export const reportRun = async (request: string, userId: string): Promise<string> => {
  try {
    const reportId = assertId(request);
    const row = Report.findByPk(reportId);

    if (!row) {
      return `Report with ID "${reportId}" not found`;
    }

    if (row.userId !== userId) {
      return `Report with ID "${reportId}" not found`;
    }

    const config = JSON.parse(row.config);
    const report = createReport(row.reportName, config);
    const result = await report.run();

    return result;
  } catch (error) {
    if (error instanceof Error) {
      return `Error running report: ${error.message}`;
    }
    return 'Error running report';
  }
};
```

- [ ] **Step 2: Verify types compile**

Run: `cd packages/messaging && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/messaging/src/command/report/reportRun.ts
git commit -m "feat(report): add reportRun command handler"
```

---

### Task 9: Create reportList and reportRemove commands

**Files:**
- Create: `packages/messaging/src/command/report/reportList.ts`
- Create: `packages/messaging/src/command/report/reportRemove.ts`

- [ ] **Step 1: Write reportList**

```typescript
// packages/messaging/src/command/report/reportList.ts
import {Report} from '../../database/models/Report.js';

export const reportList = async (userId: string): Promise<string> => {
  try {
    const reports = Report.findByUserId(userId);

    if (reports.length === 0) {
      return 'No reports configured';
    }

    const list = reports
      .map(r => {
        const schedule = r.cron ? `cron: ${r.cron}` : 'one-shot';
        return `ID: ${r.id} | ${r.reportName} | ${schedule}`;
      })
      .join('\n');

    return `Your reports:\n${list}`;
  } catch (error) {
    if (error instanceof Error) {
      return `Error listing reports: ${error.message}`;
    }
    return 'Error listing reports';
  }
};
```

- [ ] **Step 2: Write reportRemove**

```typescript
// packages/messaging/src/command/report/reportRemove.ts
import {Report} from '../../database/models/Report.js';
import {assertId} from '../../validation/assertId.js';

export interface ReportRemoveResult {
  message: string;
  reportId?: number;
}

// Format: "<reportId>"
// Example: "/reportRemove 3"
export const reportRemove = async (request: string, userId: string): Promise<ReportRemoveResult> => {
  try {
    const reportId = assertId(request);
    const row = Report.findByPk(reportId);

    if (!row) {
      return {message: `Report with ID "${reportId}" not found`};
    }

    if (row.userId !== userId) {
      return {message: `Report with ID "${reportId}" not found`};
    }

    Report.destroy(reportId);

    return {
      message: `Report "${reportId}" (${row.reportName}) removed successfully`,
      reportId,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {message: `Error removing report: ${error.message}`};
    }
    return {message: 'Error removing report'};
  }
};
```

- [ ] **Step 3: Verify types compile**

Run: `cd packages/messaging && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/messaging/src/command/report/reportList.ts packages/messaging/src/command/report/reportRemove.ts
git commit -m "feat(report): add reportList and reportRemove command handlers"
```

---

### Task 10: Export report commands and register them

**Files:**
- Modify: `packages/messaging/src/command/index.ts`
- Modify: `packages/messaging/src/startServer.ts`

- [ ] **Step 1: Add report exports to command index**

Add to `packages/messaging/src/command/index.ts`:

```typescript
export {reportAdd} from './report/reportAdd.js';
export {reportList} from './report/reportList.js';
export {reportRemove} from './report/reportRemove.js';
export {reportRun} from './report/reportRun.js';
```

- [ ] **Step 2: Register report commands in startServer.ts**

Import the new commands at the top of `packages/messaging/src/startServer.ts`:

```typescript
import {
  // ... existing imports ...
  reportAdd,
  reportList,
  reportRemove,
  reportRun,
} from './command/index.js';
```

Add these registrations inside `registerCommands()`, after the strategy commands:

```typescript
  platform.registerCommand('reportAdd', async ctx => {
    const result = await reportAdd(ctx.content, ctx.senderId);
    await ctx.reply(result.message);

    if (result.report?.cron) {
      try {
        monitors.reportScheduler.scheduleReport(result.report);
      } catch (error) {
        console.error(`Error scheduling report: ${error}`);
      }
    }
  });

  platform.registerCommand('reportList', async ctx => {
    await ctx.reply(await reportList(ctx.senderId));
  });

  platform.registerCommand('reportRemove', async ctx => {
    const result = await reportRemove(ctx.content, ctx.senderId);
    await ctx.reply(result.message);

    if (result.reportId) {
      monitors.reportScheduler.unscheduleReport(result.reportId);
    }
  });

  platform.registerCommand('reportRun', async ctx => {
    await ctx.reply('Running report...');
    const result = await reportRun(ctx.content, ctx.senderId);
    await ctx.reply(result);
  });
```

> **Note:** The `monitors.reportScheduler` references are wired up in Task 12. The types won't fully compile until then.

- [ ] **Step 3: Commit**

```bash
git add packages/messaging/src/command/index.ts packages/messaging/src/startServer.ts
git commit -m "feat(report): register report commands in messenger"
```

---

## Chunk 3: Report Scheduler Service

### Task 11: Add node-cron dependency

**Files:**
- Modify: `packages/messaging/package.json`

- [ ] **Step 1: Install node-cron**

Run: `cd packages/messaging && npm install node-cron && npm install --save-dev @types/node-cron`

- [ ] **Step 2: Commit**

```bash
git add packages/messaging/package.json package-lock.json
git commit -m "feat(report): add node-cron dependency"
```

---

### Task 12: Create ReportScheduler service

**Files:**
- Create: `packages/messaging/src/service/ReportScheduler.ts`
- Modify: `packages/messaging/src/service/index.ts`
- Modify: `packages/messaging/src/startServer.ts`

- [ ] **Step 1: Write ReportScheduler**

```typescript
// packages/messaging/src/service/ReportScheduler.ts
import cron from 'node-cron';
import {createReport} from 'trading-strategies';
import type {MessagingPlatform} from '../platform/MessagingPlatform.js';
import {Report, type ReportAttributes} from '../database/models/Report.js';

interface ScheduledReport {
  reportId: number;
  task: cron.ScheduledTask;
}

export class ReportScheduler {
  #platforms: Map<string, MessagingPlatform>;
  #scheduled: Map<number, ScheduledReport> = new Map();

  constructor(platforms: Map<string, MessagingPlatform>) {
    this.#platforms = platforms;
  }

  async start(): Promise<void> {
    const rows = Report.findAllWithCron();
    for (const row of rows) {
      try {
        this.scheduleReport(row);
      } catch (error) {
        console.error(`Failed to schedule report ${row.id} (${row.reportName}):`, error);
      }
    }
  }

  stop(): void {
    for (const scheduled of this.#scheduled.values()) {
      scheduled.task.stop();
    }
    this.#scheduled.clear();
  }

  scheduleReport(row: ReportAttributes): void {
    if (!row.cron) {
      return;
    }

    if (this.#scheduled.has(row.id)) {
      return;
    }

    const task = cron.schedule(row.cron, async () => {
      try {
        await this.#runAndNotify(row);
      } catch (error) {
        console.error(`Scheduled report ${row.id} (${row.reportName}) failed:`, error);
      }
    });

    this.#scheduled.set(row.id, {reportId: row.id, task});
    console.log(`Scheduled report "${row.id}" (${row.reportName}) with cron: ${row.cron}`);
  }

  unscheduleReport(reportId: number): void {
    const scheduled = this.#scheduled.get(reportId);
    if (scheduled) {
      scheduled.task.stop();
      this.#scheduled.delete(reportId);
      console.log(`Unscheduled report "${reportId}".`);
    }
  }

  async #runAndNotify(row: ReportAttributes): Promise<void> {
    const config = JSON.parse(row.config);
    const report = createReport(row.reportName, config);
    const result = await report.run();

    const platformPrefix = row.userId.split(':')[0];
    const platform = this.#platforms.get(platformPrefix);

    if (!platform) {
      console.warn(`No platform found for prefix "${platformPrefix}" when sending report ${row.id}`);
      return;
    }

    await platform.sendMessage(row.userId, result);
    console.log(`Report ${row.id} result sent to ${row.userId}`);
  }
}
```

- [ ] **Step 2: Export from service index**

Add to `packages/messaging/src/service/index.ts`:

```typescript
export {ReportScheduler} from './ReportScheduler.js';
```

- [ ] **Step 3: Wire ReportScheduler into startServer.ts**

Update the `Monitors` interface and startup in `packages/messaging/src/startServer.ts`:

Add `ReportScheduler` to the import from `./service/index.js`:

```typescript
import {WatchMonitor, StrategyMonitor, ReportScheduler} from './service/index.js';
```

Add to the `Monitors` interface:

```typescript
interface Monitors {
  watchMonitor: WatchMonitor;
  strategyMonitor: StrategyMonitor;
  reportScheduler: ReportScheduler;
}
```

Add to the monitors initialization:

```typescript
const monitors: Monitors = {
  watchMonitor: new WatchMonitor(platforms),
  strategyMonitor: new StrategyMonitor(platforms),
  reportScheduler: new ReportScheduler(platforms),
};
```

Add the scheduler start after the strategy monitor start:

```typescript
try {
  await monitors.reportScheduler.start();
} catch (error) {
  console.error('Error starting report scheduler:', error);
}
```

Add scheduler stop to the shutdown handler:

```typescript
const shutdown = async () => {
  try {
    monitors.watchMonitor.stop();
    await monitors.strategyMonitor.stop();
    monitors.reportScheduler.stop();
    // ...
  }
};
```

- [ ] **Step 4: Verify full build**

Run: `cd packages/messaging && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/messaging/src/service/ReportScheduler.ts packages/messaging/src/service/index.ts packages/messaging/src/startServer.ts
git commit -m "feat(report): add ReportScheduler service with cron support"
```

---

### Task 13: Final verification

- [ ] **Step 1: Run all trading-strategies tests**

Run: `cd packages/trading-strategies && npm test`
Expected: All tests pass

- [ ] **Step 2: Run all messaging tests**

Run: `cd packages/messaging && npm test`
Expected: All tests pass

- [ ] **Step 3: Verify full monorepo build**

Run: `npm run build` (from root)
Expected: No errors
