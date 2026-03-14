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
