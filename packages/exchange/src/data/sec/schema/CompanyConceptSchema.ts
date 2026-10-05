import {z} from 'zod';

export type CompanyFact = z.infer<typeof CompanyFactSchema>;

export const CompanyFactSchema = z.looseObject({
  /** Accession number of the filing that reported the value. */
  accn: z.string(),
  /** Last day of the reported period. */
  end: z.string(),
  /** Day the filing reached the SEC, which makes the value point-in-time. */
  filed: z.string(),
  form: z.string(),
  /** First day of the reported period, absent for values measured at a single instant. */
  start: z.string().optional(),
  val: z.number(),
});

export type CompanyConcept = z.infer<typeof CompanyConceptSchema>;

export const CompanyConceptSchema = z.looseObject({
  cik: z.number(),
  entityName: z.string(),
  tag: z.string(),
  taxonomy: z.string(),
  /** Reported values grouped by unit, e.g. "shares" or "USD". */
  units: z.record(z.string(), z.array(CompanyFactSchema)),
});
