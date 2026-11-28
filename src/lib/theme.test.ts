import { fc, it } from "@fast-check/vitest"
import { describe, expect } from "vitest"

import { nextTheme } from "./theme"

const scheme = fc.constantFrom("light" as const, "dark" as const)

describe("nextTheme", () => {
  it.prop([scheme, scheme])(
    "flips what shows, following the device when they match",
    (showing, device) => {
      const next = nextTheme(showing, device)
      const shows = next === "system" ? device : next
      expect(shows).not.toBe(showing)
      expect(next === "system").toBe(shows === device)
    }
  )

  it.prop([scheme])(
    "saves the choice when the device isn't known",
    (showing) => {
      expect(nextTheme(showing, "unknown")).toBe(
        showing === "dark" ? "light" : "dark"
      )
    }
  )
})
