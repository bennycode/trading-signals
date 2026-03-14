CREATE TABLE `reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`reportName` text NOT NULL,
	`config` text NOT NULL,
	`cron` text,
	`createdAt` text DEFAULT (CURRENT_TIMESTAMP)
);
