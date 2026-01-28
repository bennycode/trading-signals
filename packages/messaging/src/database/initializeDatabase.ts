import Database from 'better-sqlite3-multiple-ciphers';
import {drizzle, BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {sql} from 'drizzle-orm';
import path from 'node:path';
import * as schema from './schema.js';

if (!process.env.XMTP_DB_ENCRYPTION_KEY) {
  throw new Error('XMTP_DB_ENCRYPTION_KEY environment variable is required');
}

if (!process.env.TYPEDTRADER_DB_DIRECTORY) {
  throw new Error('TYPEDTRADER_DB_DIRECTORY environment variable is required');
}

if (!process.env.TYPEDTRADER_DB_ENCRYPTION_KEY) {
  throw new Error('TYPEDTRADER_DB_ENCRYPTION_KEY environment variable is required');
}

const dbPath = path.join(process.env.TYPEDTRADER_DB_DIRECTORY, 'typedtrader.db');

const sqlite = new Database(dbPath);
const encryptionKey = process.env.TYPEDTRADER_DB_ENCRYPTION_KEY!;
const escapedEncryptionKey = encryptionKey.replace(/'/g, "''");
sqlite.pragma(`key='${escapedEncryptionKey}'`);

export const db: BetterSQLite3Database<typeof schema> = drizzle(sqlite, {schema});

export async function initializeDatabase() {
  try {
    db.run(sql`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        exchange TEXT NOT NULL,
        isPaper INTEGER NOT NULL DEFAULT 1,
        apiKey TEXT NOT NULL,
        apiSecret TEXT NOT NULL,
        isDefault INTEGER NOT NULL DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Unable to initialize database:', error);
    throw error;
  }
}
