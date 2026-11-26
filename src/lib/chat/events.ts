// What a chat's agent sends its open tabs (src/routes/_app/c.$id.tsx).
// CHATS_CHANGED: the chat list changed (a send moved the chat up, or the
// first reply named it), so the tab loads the sidebar's list again.
// CHAT_DELETED: the chat is being deleted, so a tab showing it leaves for
// a new chat.
export const CHATS_CHANGED = "chats-changed"
export const CHAT_DELETED = "chat-deleted"
