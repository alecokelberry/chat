import { fc, it } from "@fast-check/vitest"
import { expect } from "vitest"

import { PRIVATE_GRACE, privateChatLeft } from "@/lib/chat/private-wipe"

const time = fc.integer({ min: PRIVATE_GRACE, max: 4_000_000_000_000 })

it.prop([time, fc.integer({ min: 0, max: 4_000_000_000_000 })])(
  "never ends a chat a page still holds",
  (now, lastClose) => {
    expect(privateChatLeft(true, lastClose, now)).toBe(false)
  }
)

it.prop([time, fc.integer({ min: 0, max: PRIVATE_GRACE - 1 })])(
  "waits out the grace after a close, for a reconnect",
  (now, since) => {
    expect(privateChatLeft(false, now - since, now)).toBe(false)
  }
)

it.prop([time, fc.integer({ min: PRIVATE_GRACE, max: 10 * PRIVATE_GRACE })])(
  "ends it once the grace has passed with no page",
  (now, since) => {
    expect(privateChatLeft(false, now - since, now)).toBe(true)
  }
)

it.prop([time])("ends it with no page and no close ever heard", (now) => {
  expect(privateChatLeft(false, undefined, now)).toBe(true)
})
