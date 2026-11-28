import { fc, it } from "@fast-check/vitest"
import { describe, expect, test } from "vitest"

import { appearsIn, refusalFor, siteOf, writtenIn } from "@/lib/ai/web-address"

/** Ranges off the public internet, from RFC 6890: [first, last] as
 *  32-bit numbers. */
const PRIVATE_RANGES: [string, string][] = [
  ["0.0.0.0", "0.255.255.255"],
  ["10.0.0.0", "10.255.255.255"],
  ["100.64.0.0", "100.127.255.255"],
  ["127.0.0.0", "127.255.255.255"],
  ["169.254.0.0", "169.254.255.255"],
  ["172.16.0.0", "172.31.255.255"],
  ["192.168.0.0", "192.168.255.255"],
  ["224.0.0.0", "255.255.255.255"],
]

const toNumber = (ip: string) =>
  ip.split(".").reduce((total, octet) => total * 256 + Number(octet), 0)

const dotted = (n: number) =>
  [24, 16, 8, 0].map((shift) => Math.floor(n / 2 ** shift) % 256).join(".")

/** A private IPv4 address, written any way a URL parser accepts: dotted,
 *  one decimal number, or one hex number. */
const privateHost = fc
  .constantFrom(...PRIVATE_RANGES)
  .chain(([first, last]) =>
    fc.integer({ min: toNumber(first), max: toNumber(last) })
  )
  .chain((n) => fc.constantFrom(dotted(n), String(n), `0x${n.toString(16)}`))

const scheme = fc.constantFrom("http", "https")
const path = fc.webPath()

/** A public name: a plain label under a public top-level domain. */
const publicName = fc
  .tuple(
    fc.stringMatching(/^[a-z][a-z0-9-]{0,20}[a-z0-9]$/),
    fc.constantFrom("com", "org", "dev", "io", "co.uk")
  )
  .map(([label, tld]) => `${label}.${tld}`)

describe("refusalFor", () => {
  it.prop([scheme, privateHost, path])(
    "refuses any private or local IPv4 address, however it's written",
    (s, host, p) => {
      expect(refusalFor(`${s}://${host}${p}`)).not.toBeNull()
    }
  )

  test.each(PRIVATE_RANGES.flat())(
    "refuses each private range's first and last address: %s",
    (host) => {
      expect(refusalFor(`https://${host}/`)).not.toBeNull()
    }
  )

  it.prop([
    scheme,
    fc.constantFrom(
      "localhost",
      "printer.local",
      "nas.lan",
      "db.internal",
      "box.home.arpa",
      "intranet"
    ),
    path,
  ])("refuses a local name or one with no dot", (s, host, p) => {
    expect(refusalFor(`${s}://${host}${p}`)).not.toBeNull()
  })

  it.prop([
    scheme,
    fc.constantFrom(
      "[::1]",
      "[::ffff:127.0.0.1]",
      "[fe80::1]",
      "[2606:4700::1111]"
    ),
  ])("refuses any IPv6 literal", (s, host) => {
    expect(refusalFor(`${s}://${host}/`)).not.toBeNull()
  })

  it.prop([
    fc.constantFrom("javascript", "file", "ftp", "data", "chrome", "ws"),
    publicName,
  ])("refuses any scheme but http and https", (s, host) => {
    expect(refusalFor(`${s}://${host}/`)).not.toBeNull()
  })

  it.prop([scheme, fc.stringMatching(/^[a-z]{1,8}$/), publicName])(
    "refuses an address with a login in it",
    (s, user, host) => {
      expect(refusalFor(`${s}://${user}:pw@${host}/`)).not.toBeNull()
    }
  )

  it.prop([scheme, publicName, path])("allows a public name", (s, host, p) => {
    expect(refusalFor(`${s}://${host}${p}`)).toBeNull()
  })

  test.each([
    "1.1.1.1",
    "8.8.8.8",
    "9.255.255.255",
    "11.0.0.0",
    "100.63.255.255",
    "100.128.0.0",
    "126.255.255.255",
    "128.0.0.0",
    "169.253.255.255",
    "169.255.0.0",
    "172.15.255.255",
    "172.32.0.0",
    "192.167.255.255",
    "192.169.0.0",
    "223.255.255.255",
  ])("allows the public address just past a private range: %s", (host) => {
    expect(refusalFor(`https://${host}/`)).toBeNull()
  })

  test("refuses an address over 2,048 characters", () => {
    expect(refusalFor(`https://example.com/${"a".repeat(2048)}`)).not.toBeNull()
  })
})

describe("siteOf", () => {
  it.prop([scheme, publicName, path])(
    "names the host without www.",
    (s, host, p) => {
      expect(siteOf(`${s}://www.${host}${p}`)).toBe(host)
      expect(siteOf(`${s}://${host}${p}`)).toBe(host)
    }
  )

  it.prop([
    fc.constantFrom(
      "javascript:alert(1)",
      "mailto:a@b.co",
      "file:///etc/passwd",
      "not a url"
    ),
  ])("is null for anything but an http(s) address", (url) => {
    expect(siteOf(url)).toBeNull()
  })
})

describe("appearsIn", () => {
  const address = fc
    .tuple(scheme, publicName, path)
    .map(([s, host, p]) => `${s}://${host}${p}`)
  /** Anything a model could add to an address to carry words out: at
   *  least one character an address holds that isn't closing punctuation. */
  const added = fc
    .tuple(
      fc.string({
        unit: fc.constantFrom(..."?=&/#%a1-._~:@!$'()*+,;".split("")),
        maxLength: 40,
      }),
      fc.constantFrom(..."aZ9%/=&#_-~".split(""))
    )
    .map(([more, one]) => more + one)
  /** What may sit around a written address in a message or a page. */
  const around = fc.constantFrom(
    (url: string) => url,
    (url: string) => `see ${url} now`,
    (url: string) => `see ${url}.`,
    (url: string) => `(${url}), and`,
    (url: string) => `[a page](${url})`,
    (url: string) => `"${url}"\nnext line`
  )

  it.prop([address, around])(
    "finds an address written out whole",
    (url, wrap) => {
      expect(appearsIn(url, wrap(url))).toBe(true)
    }
  )

  it.prop([address, added, around])(
    "never finds the address with anything added after it",
    (url, more, wrap) => {
      expect(appearsIn(url + more, wrap(url))).toBe(false)
    }
  )

  it.prop([address, added, around])(
    "never finds the start of a longer address",
    (url, more, wrap) => {
      expect(appearsIn(url, wrap(url + more))).toBe(false)
    }
  )

  test("finds it when another copy runs on", () => {
    const url = "https://example.org/a"
    expect(appearsIn(url, `${url}?x=1 and ${url}`)).toBe(true)
  })

  test("finds nothing for an empty address", () => {
    expect(appearsIn("", "anything")).toBe(false)
  })
})

describe("writtenIn", () => {
  test("takes a bare address the owner typed as https", () => {
    expect(
      writtenIn("https://example.org/article", "read example.org/article")
    ).toBe(true)
    expect(
      writtenIn("https://www.example.org/x", "see www.example.org/x.")
    ).toBe(true)
  })

  test("adds nothing else to a bare address", () => {
    expect(
      writtenIn("http://example.org/article", "read example.org/article")
    ).toBe(false)
    expect(
      writtenIn("https://example.org/article?q=1", "read example.org/article")
    ).toBe(false)
    expect(writtenIn("https://article", "read article")).toBe(false)
  })
})
