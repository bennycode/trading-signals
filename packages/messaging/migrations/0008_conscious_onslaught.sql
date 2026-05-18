-- Reports now reference accounts.id instead of carrying their own copy of
-- apiKey/apiSecret in the config blob. Existing rows are backfilled where
-- possible; orphans (no matching account) are removed.

ALTER TABLE `reports` ADD COLUMN `accountId` integer REFERENCES `accounts`(`id`);
--> statement-breakpoint
-- Primary backfill: match the account whose credentials the report was
-- originally created with (userId + apiKey in config).
UPDATE `reports`
SET `accountId` = (
  SELECT `a`.`id`
  FROM `accounts` `a`
  WHERE `a`.`userId` = `reports`.`userId`
    AND `a`.`apiKey` = json_extract(`reports`.`config`, '$.apiKey')
  LIMIT 1
)
WHERE `accountId` IS NULL;
--> statement-breakpoint
-- Fallback for rows whose stored apiKey has since been rotated: if the user
-- owns exactly one account, link the report to it.
UPDATE `reports`
SET `accountId` = (
  SELECT `a`.`id` FROM `accounts` `a` WHERE `a`.`userId` = `reports`.`userId` LIMIT 1
)
WHERE `accountId` IS NULL
  AND (SELECT COUNT(*) FROM `accounts` `a` WHERE `a`.`userId` = `reports`.`userId`) = 1;
--> statement-breakpoint
-- Anything still null can't be linked safely; drop it. The user can recreate
-- the report against the correct account with /reportAdd.
DELETE FROM `reports` WHERE `accountId` IS NULL;
--> statement-breakpoint
-- Strip the now-redundant credentials out of the config blob.
UPDATE `reports` SET `config` = json_remove(`config`, '$.apiKey', '$.apiSecret');
--> statement-breakpoint
-- SQLite can't ADD a NOT NULL column or attach ON DELETE CASCADE in place,
-- so recreate the table with the final schema and copy rows over. The DELETE
-- above already removed any unlinkable rows, so the NOT NULL copy is safe.
CREATE TABLE `__new_reports` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `userId` text NOT NULL,
  `accountId` integer NOT NULL REFERENCES `accounts`(`id`) ON DELETE CASCADE,
  `reportName` text NOT NULL,
  `config` text NOT NULL,
  `intervalMs` integer,
  `lastRunAt` integer,
  `createdAt` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
INSERT INTO `__new_reports` (`id`, `userId`, `accountId`, `reportName`, `config`, `intervalMs`, `lastRunAt`, `createdAt`)
SELECT `id`, `userId`, `accountId`, `reportName`, `config`, `intervalMs`, `lastRunAt`, `createdAt` FROM `reports`;
--> statement-breakpoint
DROP TABLE `reports`;
--> statement-breakpoint
ALTER TABLE `__new_reports` RENAME TO `reports`;
