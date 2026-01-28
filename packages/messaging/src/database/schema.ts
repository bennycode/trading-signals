import {sqliteTable, integer, text} from 'drizzle-orm/sqlite-core';

export const accounts = sqliteTable('accounts', {
  id: integer('id').primaryKey({autoIncrement: true}),
  name: text('name').notNull().unique(),
  exchange: text('exchange').notNull(),
  isPaper: integer('isPaper', {mode: 'boolean'}).notNull().default(true),
  apiKey: text('apiKey').notNull(),
  apiSecret: text('apiSecret').notNull(),
  createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP'),
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
