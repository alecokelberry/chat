CREATE TABLE `reply_usage` (
	`seq` integer PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`model` text NOT NULL,
	`inputTokens` integer NOT NULL,
	`outputTokens` integer NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reply_usage_user_idx` ON `reply_usage` (`userId`,`model`);