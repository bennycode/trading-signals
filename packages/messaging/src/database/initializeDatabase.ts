import Database from 'better-sqlite3-multiple-ciphers';
import {sql} from 'drizzle-orm';
import {BetterSQLite3Database, drizzle} from 'drizzle-orm/better-sqlite3';
import path from 'node:path';
import * as schema from './schema.js';

if (!process.env.XMTP_DB_ENCRYPTION_KEY) {
  throw new Error('XMTP_DB_ENCRYPTION_KEY environment variable is required');
}

if (!process.env.TYPEDTRADER_DB_DIRECTORY) {
  throw new Error('TYPEDTRADER_DB_DIRECTORY environment variable is required');
}

const dbPath = path.join(process.env.TYPEDTRADER_DB_DIRECTORY, 'typedtrader.db');

export let db: BetterSQLite3Database<typeof schema>;

export async function initializeDatabase() {
  if (!process.env.TYPEDTRADER_DB_ENCRYPTION_KEY) {
    throw new Error('TYPEDTRADER_DB_ENCRYPTION_KEY environment variable is required');
  }

  try {
    const sqlite = new Database(dbPath);

    const encryptionKey = process.env.TYPEDTRADER_DB_ENCRYPTION_KEY;

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

    console.log('Database initialized successfully');
  } catch (error) {
    throw error;
  }
}
