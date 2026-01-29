CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ownerAddress` text NOT NULL,
	`name` text NOT NULL,
	`exchange` text NOT NULL,
	`isPaper` integer DEFAULT true NOT NULL,
	`apiKey` text NOT NULL,
	`apiSecret` text NOT NULL,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_name_unique` ON `accounts` (`name`);--> statement-breakpoint
CREATE TABLE `watches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`accountId` integer NOT NULL,
	`pair` text NOT NULL,
	`intervalMs` integer NOT NULL,
	`thresholdType` text NOT NULL,
	`thresholdDirection` text NOT NULL,
	`thresholdValue` text NOT NULL,
	`baselinePrice` text NOT NULL,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP'
);
