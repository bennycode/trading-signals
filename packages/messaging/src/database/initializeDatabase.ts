import Database from 'better-sqlite3';
import path from 'node:path';

if (!process.env.XMTP_DB_ENCRYPTION_KEY) {
  throw new Error('XMTP_DB_ENCRYPTION_KEY environment variable is required');
}

const dbPath = path.join(process.cwd(), '.database', 'accounts.db');

export const db: Database.Database = new Database(dbPath);

// Enable SQLCipher encryption
db.pragma(`key = '${process.env.XMTP_DB_ENCRYPTION_KEY}'`);
db.pragma('cipher_page_size = 4096');
db.pragma('kdf_iter = 256000');
db.pragma('cipher_hmac_algorithm = HMAC_SHA512');
db.pragma('cipher_kdf_algorithm = PBKDF2_HMAC_SHA512');

export async function initializeDatabase() {
  try {
    // Create accounts table
    db.exec(`
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
