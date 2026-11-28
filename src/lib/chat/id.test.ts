import { fc, it } from "@fast-check/vitest"
import { expect } from "vitest"

import { agentName, ownerOf } from "@/lib/chat/id"

// Whatever the user id, even one with a ":" in it, the name reads back as
// the same user and chat, since a chat id (a UUID) holds none.
it.prop([
  fc.string({ unit: fc.constantFrom(":", "a", "Z", "-", "0") }),
  fc.uuid(),
])("reads back the user and chat a name was made from", (userId, id) => {
  expect(ownerOf(agentName({ userId, id }))).toEqual({ userId, id })
})
