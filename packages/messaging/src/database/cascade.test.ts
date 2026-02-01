import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import Database from 'better-sqlite3-multiple-ciphers';
import {drizzle} from 'drizzle-orm/better-sqlite3';
import {migrate} from 'drizzle-orm/better-sqlite3/migrator';
import {eq} from 'drizzle-orm';
import path from 'node:path';
import fs from 'node:fs';
import * as schema from '../database/schema.js';

const {accounts, watches} = schema;

describe('CASCADE delete', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let sqlite: Database.Database;
  const testDbPath = path.join('/tmp', `test-cascade-${Date.now()}.db`);

  beforeAll(() => {
    sqlite = new Database(testDbPath);
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite, {schema});

    migrate(db, {
      migrationsFolder: path.join(import.meta.dirname, '../../migrations'),
    });
  });

  afterAll(() => {
    sqlite.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('deletes watches when account is deleted', () => {
    const account = db
      .insert(accounts)
      .values({
        ownerAddress: 'test-owner',
        name: 'test-account',
        exchange: 'binance',
        isPaper: true,
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      })
      .returning()
      .get();

    const watch1 = db
      .insert(watches)
      .values({
        accountId: account.id,
        pair: 'BTC-USD',
        intervalMs: 60000,
        thresholdType: 'percent',
        thresholdDirection: 'up',
        thresholdValue: '5',
        baselinePrice: '50000',
      })
      .returning()
      .get();

    const watch2 = db
      .insert(watches)
      .values({
        accountId: account.id,
        pair: 'ETH-USD',
        intervalMs: 60000,
        thresholdType: 'percent',
        thresholdDirection: 'down',
        thresholdValue: '3',
        baselinePrice: '3000',
      })
      .returning()
      .get();

    const watchesBeforeDelete = db.select().from(watches).where(eq(watches.accountId, account.id)).all();

    expect(watchesBeforeDelete).toHaveLength(2);

    db.delete(accounts).where(eq(accounts.id, account.id)).run();

    const watchesAfterDelete = db.select().from(watches).where(eq(watches.accountId, account.id)).all();

    expect(watchesAfterDelete).toHaveLength(0);
  });

  it('does not delete watches for other accounts', () => {
    const account1 = db
      .insert(accounts)
      .values({
        ownerAddress: 'test-owner-1',
        name: 'test-account-1',
        exchange: 'binance',
        isPaper: true,
        apiKey: 'test-key-1',
        apiSecret: 'test-secret-1',
      })
      .returning()
      .get();

    const account2 = db
      .insert(accounts)
      .values({
        ownerAddress: 'test-owner-2',
        name: 'test-account-2',
        exchange: 'coinbase',
        isPaper: true,
        apiKey: 'test-key-2',
        apiSecret: 'test-secret-2',
      })
      .returning()
      .get();

    db.insert(watches)
      .values({
        accountId: account1.id,
        pair: 'BTC-USD',
        intervalMs: 60000,
        thresholdType: 'percent',
        thresholdDirection: 'up',
        thresholdValue: '5',
        baselinePrice: '50000',
      })
      .run();

    db.insert(watches)
      .values({
        accountId: account2.id,
        pair: 'ETH-USD',
        intervalMs: 60000,
        thresholdType: 'percent',
        thresholdDirection: 'down',
        thresholdValue: '3',
        baselinePrice: '3000',
      })
      .run();

    db.delete(accounts).where(eq(accounts.id, account1.id)).run();

    const account1Watches = db.select().from(watches).where(eq(watches.accountId, account1.id)).all();

    expect(account1Watches).toHaveLength(0);

    const account2Watches = db.select().from(watches).where(eq(watches.accountId, account2.id)).all();

    expect(account2Watches).toHaveLength(1);
  });
});
