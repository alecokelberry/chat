-- Search's full-text index of message_text (src/lib/chat/message-index.ts):
-- an FTS5 table that holds only the index, reading the text from
-- message_text by its seq, kept in step by the three triggers below.
-- unicode61 with remove_diacritics 2 matches "cafe" to "café". Written by
-- hand: drizzle-kit doesn't know virtual tables or triggers.
CREATE VIRTUAL TABLE `message_fts` USING fts5(
	text,
	content='message_text',
	content_rowid='seq',
	tokenize='unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE TRIGGER `message_text_insert` AFTER INSERT ON `message_text` BEGIN
	INSERT INTO message_fts (rowid, text) VALUES (new.seq, new.text);
END;
--> statement-breakpoint
CREATE TRIGGER `message_text_delete` AFTER DELETE ON `message_text` BEGIN
	INSERT INTO message_fts (message_fts, rowid, text) VALUES ('delete', old.seq, old.text);
END;
--> statement-breakpoint
CREATE TRIGGER `message_text_update` AFTER UPDATE ON `message_text` BEGIN
	INSERT INTO message_fts (message_fts, rowid, text) VALUES ('delete', old.seq, old.text);
	INSERT INTO message_fts (rowid, text) VALUES (new.seq, new.text);
END;
