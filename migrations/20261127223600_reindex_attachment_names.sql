-- Search now finds a question by its attachments' file names
-- (src/lib/chat/message-index.ts). Chats indexed before that hold their
-- questions' words without the names, so each is marked unindexed, and
-- Search indexes it whole again, a few chats each time it opens. Only the
-- derived index is rewritten, and an unchanged message's row is left as it
-- is. Written by hand, with no snapshot: it changes data, not the schema.
UPDATE `chat` SET `indexed` = false;
