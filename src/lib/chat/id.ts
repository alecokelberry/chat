// A chat's id: a random UUID the browser makes on the first send. Both the
// /c/<id> page and the /api/chats/<id> door check it with this.
export const CHAT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
