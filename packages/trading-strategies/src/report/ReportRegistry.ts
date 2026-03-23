import type {z} from 'zod';
import type {Report} from './Report.js';
import {SP500MomentumReport, SP500MomentumSchema} from '../report-sp500-momentum/SP500MomentumReport.js';

interface ReportEntry {
  create: (config: unknown) => Report;
  schema: z.ZodType;
  /** Returns the config from environment variables, or undefined if not configured */
  resolveConfig: () => Record<string, unknown> | undefined;
}

const registry: Record<string, ReportEntry> = {
  [SP500MomentumReport.NAME]: {
    create: (config: unknown) => new SP500MomentumReport(SP500MomentumSchema.parse(config)),
    schema: SP500MomentumSchema,
    resolveConfig: () => {
      const apiKey = process.env.MASSIVE_API_KEY;
      return apiKey ? {apiKey} : undefined;
    },
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
