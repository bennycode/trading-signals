import {eq, asc, inArray} from 'drizzle-orm';
import {db} from '../initializeDatabase.js';
import {watches, Watch as WatchType, NewWatch} from '../schema.js';

export type WatchAttributes = WatchType;
export type WatchCreationAttributes = Omit<NewWatch, 'id' | 'createdAt'>;

export class Watch {
  static create(data: WatchCreationAttributes): WatchType {
    return db.insert(watches).values(data).returning().get();
  }

  static findByPk(id: number): WatchType | undefined {
    return db.select().from(watches).where(eq(watches.id, id)).get();
  }

  static findAllOrderedById(): WatchType[] {
    return db.select().from(watches).orderBy(asc(watches.id)).all();
  }

  static findByAccountIds(accountIds: number[]): WatchType[] {
    if (accountIds.length === 0) {
      return [];
    }
    return db
      .select()
      .from(watches)
      .where(inArray(watches.accountId, accountIds))
      .orderBy(asc(watches.id))
      .all();
  }

  static destroy(id: number): void {
    db.delete(watches).where(eq(watches.id, id)).run();
  }
}
