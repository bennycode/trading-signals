PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_watches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`accountId` integer NOT NULL,
	`pair` text NOT NULL,
	`intervalMs` integer NOT NULL,
	`thresholdType` text NOT NULL,
	`thresholdDirection` text NOT NULL,
	`thresholdValue` text NOT NULL,
	`baselinePrice` text NOT NULL,
	`alertPrice` text NOT NULL,
	`createdAt` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_watches`("id", "accountId", "pair", "intervalMs", "thresholdType", "thresholdDirection", "thresholdValue", "baselinePrice", "alertPrice", "createdAt") SELECT "id", "accountId", "pair", "intervalMs", "thresholdType", "thresholdDirection", "thresholdValue", "baselinePrice", CASE WHEN "thresholdType" = 'percent' THEN CAST(CAST("baselinePrice" AS REAL) * (1.0 + CASE WHEN "thresholdDirection" = 'up' THEN 1 ELSE -1 END * CAST("thresholdValue" AS REAL) / 100.0) AS TEXT) ELSE CAST(CAST("baselinePrice" AS REAL) + CASE WHEN "thresholdDirection" = 'up' THEN 1 ELSE -1 END * CAST("thresholdValue" AS REAL) AS TEXT) END, "createdAt" FROM `watches`;--> statement-breakpoint
DROP TABLE `watches`;--> statement-breakpoint
ALTER TABLE `__new_watches` RENAME TO `watches`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
