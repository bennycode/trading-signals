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

  static findAllWithInterval(): ReportRow[] {
    return db
      .select()
      .from(reports)
      .where(isNotNull(reports.intervalMs))
      .orderBy(asc(reports.id))
      .all();
  }

  static destroy(id: number): void {
    db.delete(reports).where(eq(reports.id, id)).run();
  }
}
