CREATE TABLE `reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`reportName` text NOT NULL,
	`config` text NOT NULL,
	`intervalMs` integer,
	`createdAt` text DEFAULT (CURRENT_TIMESTAMP)
);
