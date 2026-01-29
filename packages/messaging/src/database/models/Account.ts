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

  static findByOwnerAddress(ownerAddress: string): AccountType[] {
    return db
      .select()
      .from(accounts)
      .where(eq(accounts.ownerAddress, ownerAddress))
      .orderBy(asc(accounts.id))
      .all();
  }

  static findByOwnerAddressAndId(ownerAddress: string, id: number): AccountType | undefined {
    return db
      .select()
      .from(accounts)
      .where(and(eq(accounts.ownerAddress, ownerAddress), eq(accounts.id, id)))
      .get();
  }

  static findAllOrderedById(): AccountType[] {
    return db.select().from(accounts).orderBy(asc(accounts.id)).all();
  }

  static destroy(id: number): void {
    db.delete(accounts).where(eq(accounts.id, id)).run();
  }
}
