import Database from 'better-sqlite3-multiple-ciphers';
import {BetterSQLite3Database, drizzle} from 'drizzle-orm/better-sqlite3';
import {migrate} from 'drizzle-orm/better-sqlite3/migrator';
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

  const dbPath = path.join(dbDirectory, 'typedtrader.db');
  const sqlite = new Database(dbPath);
  const escapedEncryptionKey = encryptionKey.replace(/'/g, "''");
  sqlite.pragma(`key='${escapedEncryptionKey}'`);
  sqlite.pragma('foreign_keys = ON');

  db = drizzle(sqlite, {schema});

  // Run migrations
  migrate(db, {migrationsFolder: path.join(import.meta.dirname, '../../migrations')});

  console.log(`TypedTrader database initialized successfully in "${dbPath}".`);
}
