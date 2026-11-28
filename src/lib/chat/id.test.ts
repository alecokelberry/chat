import { fc, it } from "@fast-check/vitest"
import { expect } from "vitest"

import {
  AGENT_CHAT_ID,
  agentName,
  CHAT_ID,
  isPrivateChat,
  newPrivateChatId,
  ownerOf,
} from "@/lib/chat/id"

// Whatever the user id, even one with a ":" in it, the name reads back as
// the same user and chat, since a chat id (a UUID) holds none.
it.prop([
  fc.string({ unit: fc.constantFrom(":", "a", "Z", "-", "0") }),
  fc.uuid(),
])("reads back the user and chat a name was made from", (userId, id) => {
  expect(ownerOf(agentName({ userId, id }))).toEqual({ userId, id })
})

// A private chat's id is a chat id behind "private-": the door takes both,
// and only a private one reads as private.
it.prop([fc.uuid()])("tells a private chat's id from a saved one's", (id) => {
  expect(CHAT_ID.test(id)).toBe(true)
  expect(isPrivateChat(id)).toBe(false)
  expect(isPrivateChat(`private-${id}`)).toBe(true)
  expect(AGENT_CHAT_ID.test(`private-${id}`)).toBe(true)
  expect(CHAT_ID.test(`private-${id}`)).toBe(false)
  expect(isPrivateChat(newPrivateChatId())).toBe(true)
})
