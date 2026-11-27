-- Settings › Customize (src/lib/ai/style.ts): the response style and the
-- user's own instructions, on Better Auth's user table (its
-- user.additionalFields in src/lib/auth/server.ts). Additive, with
-- defaults, so the code before this still works on it.
ALTER TABLE `user` ADD `responseStyle` text DEFAULT 'default' NOT NULL;
ALTER TABLE `user` ADD `customInstructions` text DEFAULT '' NOT NULL;
