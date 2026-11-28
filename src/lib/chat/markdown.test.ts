import { fc, it } from "@fast-check/vitest"
import { describe, expect, test } from "vitest"

import { prepareMarkdown } from "@/lib/chat/markdown"

describe("math", () => {
  test("reads inline $…$ and \\(…\\) as math", () => {
    expect(prepareMarkdown("so $x^2$ here")).toBe("so $$x^2$$ here")
    expect(prepareMarkdown("so \\(x^2\\) here")).toBe("so $$x^2$$ here")
  })

  test("leaves prices as text", () => {
    expect(prepareMarkdown("it costs $5 and $10")).toBe("it costs $5 and $10")
  })

  test("leaves an escaped dollar sign alone", () => {
    expect(prepareMarkdown("\\$x\\$")).toBe("\\$x\\$")
  })

  test("puts a display formula on its own lines", () => {
    expect(prepareMarkdown("\\[x\\]")).toBe("$$\nx\n$$")
  })
})

describe("code", () => {
  test("names a fence's language the way Shiki does", () => {
    expect(prepareMarkdown("```ts\nconst x = 1\n```")).toBe(
      "```TypeScript\nconst x = 1\n```"
    )
  })

  test("keeps a language it can't highlight", () => {
    expect(prepareMarkdown("```nonsense\nx\n```")).toBe("```nonsense\nx\n```")
  })

  test("leaves money and math inside a fence alone", () => {
    const code = "```\n$x$ and \\(y\\) and $5 and $10\n```"
    expect(prepareMarkdown(code)).toBe(code)
  })

  test("treats an unclosed fence as code to the end", () => {
    const code = "```\n$x$"
    expect(prepareMarkdown(code)).toBe(code)
  })
})

describe("streaming", () => {
  test("holds back a fence line still being typed", () => {
    expect(prepareMarkdown("hello\n```ty", true)).toBe("hello")
  })

  test("holds back an inline formula that hasn't closed", () => {
    expect(prepareMarkdown("so $x^2", true)).toBe("so")
  })

  test("holds back a display formula that hasn't closed", () => {
    expect(prepareMarkdown("a\n\n$$\nx", true)).toBe("a")
  })

  test("holds back table rows until the delimiter row arrives", () => {
    expect(prepareMarkdown("a\n\n| h |", true)).toBe("a")
    const table = "a\n\n| h |\n| - |"
    expect(prepareMarkdown(table, true)).toBe(table)
  })

  test("holds back nothing in a finished reply", () => {
    expect(prepareMarkdown("plain words", true)).toBe("plain words")
  })
})

describe("for any reply", () => {
  const reply = fc.string({
    unit: fc.constantFrom(..."ab $\\()[]|-`~\n:".split("")),
  })

  it.prop([reply])("never throws, even cut off at any point", (text) => {
    for (let end = 0; end <= text.length; end++) {
      prepareMarkdown(text.slice(0, end), true)
      prepareMarkdown(text.slice(0, end))
    }
  })

  it.prop([fc.string({ unit: fc.constantFrom(..."ab $\\()[]|-:".split("")) })])(
    "keeps a fenced block's lines exactly",
    (body) => {
      const lines = body.split("\n").filter((line) => !/^\s*[`~]/.test(line))
      const code = lines.join("\n")
      const out = prepareMarkdown(`\`\`\`\n${code}\n\`\`\``)
      expect(out).toBe(`\`\`\`\n${code}\n\`\`\``)
    }
  )
})
