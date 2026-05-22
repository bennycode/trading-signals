import type {z} from 'zod';
import type {AlpacaAPI} from '@typedtrader/exchange';
import type {Report} from './Report.js';
import {SP500HeatmapReport, SP500HeatmapSchema} from '../report-sp500-heatmap/SP500HeatmapReport.js';
import {SP500MomentumReport, SP500MomentumSchema} from '../report-sp500-momentum/SP500MomentumReport.js';
import {ScalpScannerReport, ScalpScannerSchema} from '../report-scalp-scanner/ScalpScannerReport.js';

interface ReportEntry {
  /**
   * Constructs a report. For `requiresAccount` reports the caller must pass an `AlpacaAPI`
   * instance built from the bound exchange account; otherwise an error is thrown.
   */
  create: (config: unknown, api?: AlpacaAPI) => Report;
  schema: z.ZodType;
  /**
   * Returns the base config resolved from environment variables, or `undefined` when the report
   * cannot be run because its required environment variables are missing.
   *
   * Reports that take their exchange credentials from an account at runtime
   * (see `requiresAccount`) should return `{}` here — the caller resolves the account and
   * passes an `AlpacaAPI` to `createReport()`/`create()`.
   */
  resolveConfig: () => Record<string, unknown> | undefined;
  /** When true, this report requires an exchange account; the caller must supply an `AlpacaAPI`. */
  requiresAccount?: boolean;
}

function requireApi(name: string, api: AlpacaAPI | undefined): AlpacaAPI {
  if (!api) {
    throw new Error(`Report "${name}" requires an exchange account but no AlpacaAPI was provided.`);
  }
  return api;
}

const registry: Record<string, ReportEntry> = {
  [ScalpScannerReport.NAME]: {
    create: (config, api) =>
      new ScalpScannerReport(ScalpScannerSchema.parse(config), requireApi(ScalpScannerReport.NAME, api)),
    requiresAccount: true,
    resolveConfig: () => ({}),
    schema: ScalpScannerSchema,
  },
  [SP500HeatmapReport.NAME]: {
    create: (config, api) =>
      new SP500HeatmapReport(SP500HeatmapSchema.parse(config), requireApi(SP500HeatmapReport.NAME, api)),
    requiresAccount: true,
    resolveConfig: () => ({}),
    schema: SP500HeatmapSchema,
  },
  [SP500MomentumReport.NAME]: {
    create: (config, api) =>
      new SP500MomentumReport(SP500MomentumSchema.parse(config), requireApi(SP500MomentumReport.NAME, api)),
    requiresAccount: true,
    resolveConfig: () => ({}),
    schema: SP500MomentumSchema,
  },
};

export function createReport(name: string, config: unknown, api?: AlpacaAPI): Report {
  const entry = registry[name];
  if (!entry) {
    throw new Error(`Unknown report "${name}". Available: ${getReportNames().join(', ')}`);
  }
  return entry.create(config, api);
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
