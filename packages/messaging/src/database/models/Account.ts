import {eq, and, asc} from 'drizzle-orm';
import {db} from '../initializeDatabase.js';
import {accounts, Account as AccountType, NewAccount} from '../schema.js';

export type AccountAttributes = AccountType;
export type AccountCreationAttributes = Omit<NewAccount, 'id' | 'createdAt' | 'updatedAt'>;

export class Account {
  static create(data: AccountCreationAttributes): AccountType {
    return db.insert(accounts).values(data).returning().get();
  }

  static findByPk(id: number): AccountType | undefined {
    return db.select().from(accounts).where(eq(accounts.id, id)).get();
  }

  static findByUserId(userId: string): AccountType[] {
    return db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .orderBy(asc(accounts.id))
      .all();
  }

  static findByUserIdAndId(userId: string, id: number): AccountType | undefined {
    return db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.id, id)))
      .get();
  }

  static findAllOrderedById(): AccountType[] {
    return db.select().from(accounts).orderBy(asc(accounts.id)).all();
  }

  static destroy(id: number): void {
    db.delete(accounts).where(eq(accounts.id, id)).run();
  }
}
