-- The Library lists every attachment from its own index
-- (src/lib/chat/library.ts), which a chat's agent fills as it indexes the
-- chat for Search. Chats indexed before the Library have no rows there, so
-- each is marked unindexed, and opening the Library (or Search) has a few
-- index themselves whole each time. Only the derived indexes are written,
-- never a chat, and an unchanged message's rows are left as they are, so
-- running this again does no harm. Written by hand, with no snapshot: it
-- changes data, not the schema.
UPDATE `chat` SET `indexed` = false;
