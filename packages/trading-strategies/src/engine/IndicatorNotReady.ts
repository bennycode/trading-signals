/**
 * Thrown by a fact getter whose indicator has no result yet. The engine catches it per rule and
 * reads it as "this rule cannot judge anything yet", which is what lets a rule that reads no
 * indicator run during warm-up.
 */
export class IndicatorNotReady extends Error {
  constructor(name: string) {
    super(`Indicator "${name}" has no result yet`);
  }
}
