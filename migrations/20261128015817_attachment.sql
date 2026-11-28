CREATE TABLE `attachment` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`chatId` text NOT NULL,
	`messageId` text NOT NULL,
	`part` integer NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`size` integer NOT NULL,
	`at` integer NOT NULL,
	FOREIGN KEY (`userId`,`chatId`) REFERENCES `chat`(`userId`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attachment_part_idx` ON `attachment` (`userId`,`chatId`,`messageId`,`part`);--> statement-breakpoint
CREATE INDEX `attachment_user_at_idx` ON `attachment` (`userId`,`at`,`seq`);