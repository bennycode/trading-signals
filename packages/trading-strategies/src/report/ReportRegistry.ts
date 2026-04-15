import type {z} from 'zod';
import type {Report} from './Report.js';
import {SP500HeatmapReport, SP500HeatmapSchema} from '../report-sp500-heatmap/SP500HeatmapReport.js';
import {SP500MomentumReport, SP500MomentumSchema} from '../report-sp500-momentum/SP500MomentumReport.js';
import {ScalpScannerReport, ScalpScannerSchema} from '../report-scalp-scanner/ScalpScannerReport.js';

interface ReportEntry {
  create: (config: unknown) => Report;
  schema: z.ZodType;
  /**
   * Returns the base config resolved from environment variables, or `undefined` when the report
   * cannot be run because its required environment variables are missing.
   *
   * Reports that expect their credentials to come from an exchange account at runtime
   * (see `requiresAccount`) should return `{}` here — the account credentials are merged
   * into this object by the caller before invoking `create()`.
   */
  resolveConfig: () => Record<string, unknown> | undefined;
  /** When true, this report requires an exchange account (apiKey/apiSecret) passed at runtime */
  requiresAccount?: boolean;
}

const registry: Record<string, ReportEntry> = {
  [SP500HeatmapReport.NAME]: {
    create: (config: unknown) => new SP500HeatmapReport(SP500HeatmapSchema.parse(config)),
    schema: SP500HeatmapSchema,
    requiresAccount: true,
    resolveConfig: () => ({}),
  },
  [SP500MomentumReport.NAME]: {
    create: (config: unknown) => new SP500MomentumReport(SP500MomentumSchema.parse(config)),
    schema: SP500MomentumSchema,
    requiresAccount: true,
    resolveConfig: () => ({}),
  },
  [ScalpScannerReport.NAME]: {
    create: (config: unknown) => new ScalpScannerReport(ScalpScannerSchema.parse(config)),
    schema: ScalpScannerSchema,
    requiresAccount: true,
    resolveConfig: () => ({}),
  },
};

export function createReport(name: string, config: unknown): Report {
  const entry = registry[name];
  if (!entry) {
    throw new Error(`Unknown report "${name}". Available: ${getReportNames().join(', ')}`);
  }
  return entry.create(config);
}

/** Returns names of all registered reports */
export function getReportNames(): string[] {
  return Object.keys(registry);
}

/**
 * Returns names of reports that can currently be run.
 *
 * A report is available when `resolveConfig()` returns a non-undefined value. Reports that
 * require an exchange account at runtime return `{}` here, so they are always listed —
 * the calling command is expected to inject the account credentials before calling `createReport`.
 */
export function getAvailableReportNames(): string[] {
  return Object.entries(registry)
    .filter(([, entry]) => entry.resolveConfig() !== undefined)
    .map(([name]) => name);
}

/**
 * Resolves the base config for a report.
 *
 * Returns `undefined` when the report cannot be run (missing environment variables).
 * For account-required reports this returns an empty object `{}` — the caller must merge
 * the account credentials (`apiKey`/`apiSecret`) before passing the result to `createReport`.
 */
export function resolveReportConfig(name: string): Record<string, unknown> | undefined {
  const entry = registry[name];
  return entry?.resolveConfig();
}

/** Returns true if the report requires an exchange account (apiKey/apiSecret) at runtime */
export function reportRequiresAccount(name: string): boolean {
  const entry = registry[name];
  return entry?.requiresAccount ?? false;
}
