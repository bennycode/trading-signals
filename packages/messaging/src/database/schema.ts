import {sqliteTable, integer, text, type AnySQLiteColumn} from 'drizzle-orm/sqlite-core';
import {sql} from 'drizzle-orm';

export const accounts = sqliteTable('accounts', {
  apiKey: text('apiKey').notNull(),
  apiSecret: text('apiSecret').notNull(),
  createdAt: text('createdAt').default('CURRENT_TIMESTAMP'),
  exchange: text('exchange').notNull(),
  id: integer('id').primaryKey({autoIncrement: true}),
  isPaper: integer('isPaper', {mode: 'boolean'}).notNull().default(true),
  /**
   * Optional reference to another account whose credentials supply market data for this
   * one. Required for brokers without their own data feed (e.g. Trading212, which reuses
   * an existing Alpaca account). `set null` so deleting the data-source account leaves
   * this account intact (just without a feed) rather than cascade-deleting it.
   */
  marketDataAccountId: integer('marketDataAccountId').references((): AnySQLiteColumn => accounts.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull().unique(),
  updatedAt: text('updatedAt').default('CURRENT_TIMESTAMP'),
  userId: text('userId').notNull(),
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export const watches = sqliteTable('watches', {
  accountId: integer('accountId')
    .notNull()
    .references(() => accounts.id, {onDelete: 'cascade'}),
  alertPrice: text('alertPrice').notNull(),
  baselinePrice: text('baselinePrice').notNull(),
  createdAt: text('createdAt').default(sql`(CURRENT_TIMESTAMP)`),
  id: integer('id').primaryKey({autoIncrement: true}),
  intervalMs: integer('intervalMs').notNull(),
  pair: text('pair').notNull(),
  thresholdDirection: text('thresholdDirection', {enum: ['up', 'down']}).notNull(),
  thresholdType: text('thresholdType', {enum: ['percent', 'absolute']}).notNull(),
  thresholdValue: text('thresholdValue').notNull(),
});

export type Watch = typeof watches.$inferSelect;
export type NewWatch = typeof watches.$inferInsert;

export const strategies = sqliteTable('strategies', {
  accountId: integer('accountId')
    .notNull()
    .references(() => accounts.id, {onDelete: 'cascade'}),
  config: text('config').notNull(),
  createdAt: text('createdAt').default(sql`(CURRENT_TIMESTAMP)`),
  id: integer('id').primaryKey({autoIncrement: true}),
  pair: text('pair').notNull(),
  state: text('state'),
  strategyName: text('strategyName').notNull(),
});

export type StrategyRow = typeof strategies.$inferSelect;
export type NewStrategyRow = typeof strategies.$inferInsert;

export const reports = sqliteTable('reports', {
  accountId: integer('accountId')
    .notNull()
    .references(() => accounts.id, {onDelete: 'cascade'}),
  config: text('config').notNull(),
  createdAt: text('createdAt').default(sql`(CURRENT_TIMESTAMP)`),
  id: integer('id').primaryKey({autoIncrement: true}),
  intervalMs: integer('intervalMs'),
  lastRunAt: integer('lastRunAt'),
  reportName: text('reportName').notNull(),
  userId: text('userId').notNull(),
});

export type ReportRow = typeof reports.$inferSelect;
export type NewReportRow = typeof reports.$inferInsert;
