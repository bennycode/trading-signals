ALTER TABLE `accounts` RENAME COLUMN "ownerAddress" TO "userId";--> statement-breakpoint
UPDATE `accounts` SET `userId` = 'xmtp:' || `userId`;
