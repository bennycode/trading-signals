import {db} from '../initializeDatabase.js';

export interface AccountAttributes {
  id: number;
  name: string;
  exchange: string;
  isPaper: boolean;
  apiKey: string;
  apiSecret: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AccountCreationAttributes extends Omit<AccountAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class Account {
  static create(data: AccountCreationAttributes): AccountAttributes {
    const stmt = db.prepare(`
      INSERT INTO accounts (name, exchange, isPaper, apiKey, apiSecret, isDefault)
      VALUES (@name, @exchange, @isPaper, @apiKey, @apiSecret, @isDefault)
    `);

    const info = stmt.run({
      ...data,
      isPaper: data.isPaper ? 1 : 0,
      isDefault: data.isDefault ? 1 : 0,
    });

    return this.findByPk(info.lastInsertRowid as number)!;
  }

  static findByPk(id: number): AccountAttributes | null {
    const stmt = db.prepare('SELECT * FROM accounts WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) {
      return null;
    }

    return {
      ...row,
      isPaper: Boolean(row.isPaper),
      isDefault: Boolean(row.isDefault),
    };
  }

  static findAll(options?: {attributes?: string[]; order?: [string, string][]}): AccountAttributes[] {
    let sql = 'SELECT ';

    if (options?.attributes) {
      sql += options.attributes.join(', ');
    } else {
      sql += '*';
    }

    sql += ' FROM accounts';

    if (options?.order) {
      sql += ' ORDER BY ' + options.order.map(([col, dir]) => `${col} ${dir}`).join(', ');
    }

    const stmt = db.prepare(sql);
    const rows = stmt.all() as any[];

    return rows.map(row => ({
      ...row,
      isPaper: Boolean(row.isPaper),
      isDefault: Boolean(row.isDefault),
    }));
  }

  static update(_data: Partial<AccountAttributes>, where: {isDefault?: boolean}): void {
    if (where.isDefault !== undefined) {
      const stmt = db.prepare('UPDATE accounts SET isDefault = 0 WHERE isDefault = 1');
      stmt.run();
    }
  }

  static destroy(id: number): void {
    const stmt = db.prepare('DELETE FROM accounts WHERE id = ?');
    stmt.run(id);
  }
}
