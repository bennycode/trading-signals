import Database from 'better-sqlite3';
import {drizzle, BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {sql} from 'drizzle-orm';
import path from 'node:path';
import * as schema from './schema.js';

if (!process.env.XMTP_DB_ENCRYPTION_KEY) {
  throw new Error('XMTP_DB_ENCRYPTION_KEY environment variable is required');
}

const dbPath = path.join(process.cwd(), '.database', 'accounts.db');

const sqlite = new Database(dbPath);

// Enable SQLCipher encryption
sqlite.pragma(`key = '${process.env.XMTP_DB_ENCRYPTION_KEY}'`);
sqlite.pragma('cipher_page_size = 4096');
sqlite.pragma('kdf_iter = 256000');
sqlite.pragma('cipher_hmac_algorithm = HMAC_SHA512');
sqlite.pragma('cipher_kdf_algorithm = PBKDF2_HMAC_SHA512');

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
