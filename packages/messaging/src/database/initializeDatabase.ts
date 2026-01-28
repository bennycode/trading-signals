import Database from 'better-sqlite3-multiple-ciphers';
import {sql} from 'drizzle-orm';
import {BetterSQLite3Database, drizzle} from 'drizzle-orm/better-sqlite3';
import path from 'node:path';
import * as schema from './schema.js';

export let db: BetterSQLite3Database<typeof schema>;

export async function initializeDatabase() {
  const dbDirectory = process.env.TYPEDTRADER_DB_DIRECTORY;
  const encryptionKey = process.env.TYPEDTRADER_DB_ENCRYPTION_KEY;

  if (!dbDirectory) {
    throw new Error('TYPEDTRADER_DB_DIRECTORY environment variable is required');
  }

  if (!encryptionKey) {
    throw new Error('TYPEDTRADER_DB_ENCRYPTION_KEY environment variable is required');
  }

  try {
    const dbPath = path.join(dbDirectory, 'typedtrader.db');
    const sqlite = new Database(dbPath);
    const escapedEncryptionKey = encryptionKey.replace(/'/g, "''");
    sqlite.pragma(`key='${escapedEncryptionKey}'`);

    db = drizzle(sqlite, {schema});
    db.run(sql`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        exchange TEXT NOT NULL,
        isPaper INTEGER NOT NULL DEFAULT 1,
        apiKey TEXT NOT NULL,
        apiSecret TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log(`TypedTrader database initialized successfully in "${dbPath}".`);
  } catch (error) {
    throw error;
  }
}
