import {sqliteTable, integer, text} from 'drizzle-orm/sqlite-core';
import {sql} from 'drizzle-orm';

export const accounts = sqliteTable('accounts', {
  id: integer('id').primaryKey({autoIncrement: true}),
  userId: text('userId').notNull(),
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

export const watches = sqliteTable('watches', {
  id: integer('id').primaryKey({autoIncrement: true}),
  accountId: integer('accountId')
    .notNull()
    .references(() => accounts.id, {onDelete: 'cascade'}),
  pair: text('pair').notNull(),
  intervalMs: integer('intervalMs').notNull(),
  thresholdType: text('thresholdType', {enum: ['percent', 'absolute']}).notNull(),
  thresholdDirection: text('thresholdDirection', {enum: ['up', 'down']}).notNull(),
  thresholdValue: text('thresholdValue').notNull(),
  baselinePrice: text('baselinePrice').notNull(),
  alertPrice: text('alertPrice').notNull(),
  createdAt: text('createdAt').default(sql`(CURRENT_TIMESTAMP)`),
});

export type Watch = typeof watches.$inferSelect;
export type NewWatch = typeof watches.$inferInsert;

export const strategies = sqliteTable('strategies', {
  id: integer('id').primaryKey({autoIncrement: true}),
  accountId: integer('accountId')
    .notNull()
    .references(() => accounts.id, {onDelete: 'cascade'}),
  strategyName: text('strategyName').notNull(),
  config: text('config').notNull(),
  pair: text('pair').notNull(),
  intervalMs: integer('intervalMs').notNull(),
  state: text('state'),
  createdAt: text('createdAt').default(sql`(CURRENT_TIMESTAMP)`),
});

export type StrategyRow = typeof strategies.$inferSelect;
export type NewStrategyRow = typeof strategies.$inferInsert;

export const reports = sqliteTable('reports', {
  id: integer('id').primaryKey({autoIncrement: true}),
  userId: text('userId').notNull(),
  reportName: text('reportName').notNull(),
  config: text('config').notNull(),
  intervalMs: integer('intervalMs'),
  createdAt: text('createdAt').default(sql`(CURRENT_TIMESTAMP)`),
});

export type ReportRow = typeof reports.$inferSelect;
export type NewReportRow = typeof reports.$inferInsert;
