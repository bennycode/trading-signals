import {eq, asc, inArray} from 'drizzle-orm';
import {db} from '../initializeDatabase.js';
import {strategies, StrategyRow, NewStrategyRow} from '../schema.js';

export type StrategyAttributes = StrategyRow;
export type StrategyCreationAttributes = Omit<NewStrategyRow, 'id' | 'createdAt' | 'state'>;

export class Strategy {
  static create(data: StrategyCreationAttributes): StrategyRow {
    return db.insert(strategies).values(data).returning().get();
  }

  static findByPk(id: number): StrategyRow | undefined {
    return db.select().from(strategies).where(eq(strategies.id, id)).get();
  }

  static findAllOrderedById(): StrategyRow[] {
    return db.select().from(strategies).orderBy(asc(strategies.id)).all();
  }

  static findByAccountIds(accountIds: number[]): StrategyRow[] {
    if (accountIds.length === 0) {
      return [];
    }
    return db
      .select()
      .from(strategies)
      .where(inArray(strategies.accountId, accountIds))
      .orderBy(asc(strategies.id))
      .all();
  }

  static updateState(id: number, state: string | null): void {
    db.update(strategies).set({state}).where(eq(strategies.id, id)).run();
  }

  static destroy(id: number): void {
    db.delete(strategies).where(eq(strategies.id, id)).run();
  }
}
