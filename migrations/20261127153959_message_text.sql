CREATE TABLE `message_text` (
	`seq` integer PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`chatId` text NOT NULL,
	`messageId` text NOT NULL,
	`text` text NOT NULL,
	FOREIGN KEY (`userId`,`chatId`) REFERENCES `chat`(`userId`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_text_message_idx` ON `message_text` (`userId`,`chatId`,`messageId`);