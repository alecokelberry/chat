CREATE TABLE `chat` (
	`userId` text NOT NULL,
	`id` text NOT NULL,
	`title` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	PRIMARY KEY(`userId`, `id`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_userId_updatedAt_idx` ON `chat` (`userId`,`updatedAt`);