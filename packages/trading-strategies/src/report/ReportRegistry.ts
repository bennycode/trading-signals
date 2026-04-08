import type {z} from 'zod';
import type {Report} from './Report.js';
import {SP500MomentumReport, SP500MomentumSchema} from '../report-sp500-momentum/SP500MomentumReport.js';
import {ScalpScannerReport, ScalpScannerSchema} from '../report-scalp-scanner/ScalpScannerReport.js';

interface ReportEntry {
  create: (config: unknown) => Report;
  schema: z.ZodType;
  /** Returns the config from environment variables, or undefined if not configured */
  resolveConfig: () => Record<string, unknown> | undefined;
  /** When true, this report requires an exchange account (apiKey/apiSecret) passed at runtime */
  requiresAccount?: boolean;
}

const registry: Record<string, ReportEntry> = {
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

/** Returns names of reports whose env-based config is available */
export function getAvailableReportNames(): string[] {
  return Object.entries(registry)
    .filter(([, entry]) => entry.resolveConfig() !== undefined)
    .map(([name]) => name);
}

/** Resolves config from environment for a given report, or undefined if not configured */
export function resolveReportConfig(name: string): Record<string, unknown> | undefined {
  const entry = registry[name];
  return entry?.resolveConfig();
}

/** Returns true if the report requires an exchange account (apiKey/apiSecret) at runtime */
export function reportRequiresAccount(name: string): boolean {
  const entry = registry[name];
  return entry?.requiresAccount ?? false;
}
