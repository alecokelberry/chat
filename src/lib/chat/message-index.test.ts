import { readdirSync, readFileSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"

import { fc, it } from "@fast-check/vitest"
import { beforeAll, expect, test } from "vitest"

import { jsonChunks, matchQuery, wordsOf } from "@/lib/chat/message-index"

// Search's query against a real FTS5 index: D1 is SQLite, so the app's own
// migrations run in Node's built-in SQLite, giving the same table, the
// same tokenizer (unicode61, diacritics removed) and the same MATCH
// syntax as live, in memory.
let db: DatabaseSync

beforeAll(() => {
  db = new DatabaseSync(":memory:", { enableForeignKeyConstraints: false })
  for (const file of readdirSync("migrations")
    .filter((name) => name.endsWith(".sql"))
    .toSorted()) {
    db.exec(readFileSync(`migrations/${file}`, "utf8"))
  }
})

/** The ids of the messages holding what was typed, as Search asks. */
function search(typed: string) {
  const query = matchQuery(typed)
  if (query === null) return null
  return db
    .prepare(
      "select messageId from message_fts join message_text on seq = message_fts.rowid where message_fts match ?"
    )
    .all(query)
    .map((row) => row.messageId)
}

function holding(text: string) {
  const id = crypto.randomUUID()
  db.prepare(
    "insert into message_text (userId, chatId, messageId, text) values ('u', 'c', ?, ?)"
  ).run(id, text)
  return id
}

/** What people type, FTS5's own syntax included: quotes, stars, brackets,
 *  minus, colons, carets and its operator words. */
const typed = fc.string({
  unit: fc.oneof(
    fc.constantFrom(
      '"',
      "*",
      "(",
      ")",
      "-",
      ":",
      "^",
      "+",
      "'",
      " ",
      "NEAR",
      "AND",
      "OR",
      "NOT",
      "{",
      "}"
    ),
    fc.constantFrom("a", "é", "Z", "7", "ß", "日")
  ),
  maxLength: 30,
})

const word = fc.stringMatching(/^[a-z]{2,12}$/)

it.prop([typed])("whatever is typed, the query is valid FTS5", (text) => {
  expect(() => search(text)).not.toThrow()
})

test.each([
  ["", null],
  ["a", null],
  ['"*', null],
  ["ab", '"ab"*'],
  ['cats "and" dogs', '"cats" "and" "dogs"*'],
  ["NEAR(a b)", '"NEAR" "a" "b"*'],
])("%j is the query %j", (text, query) => {
  expect(matchQuery(text)).toBe(query)
})

it.prop([
  word,
  word,
  fc.integer({ min: 2, max: 12 }),
  fc.constantFrom("", '"', "(", "-", "*", ":", "^"),
])(
  "finds a message by its words, the last one half typed, in any case and amid FTS5 syntax",
  (first, second, typedLength, noise) => {
    const id = holding(`${first} then ${second}`)
    const half = second.slice(0, typedLength)
    expect(
      search(`${noise}${first.toUpperCase()}${noise} ${noise}${half}`)
    ).toContain(id)
  }
)

test("finds café when cafe is typed", () => {
  const id = holding("a café near the station")
  expect(search("cafe")).toContain(id)
})

test("a question's attachments are found by their names, not their text", () => {
  const question = holding(
    wordsOf({
      id: "q",
      role: "user",
      parts: [
        {
          type: "file",
          mediaType: "image/jpeg",
          filename: "zion-sunrise.jpg",
          url: "data:image/jpeg;base64,AA==",
        },
        {
          type: "data-document",
          data: {
            name: "Quarterly-report-v12.pdf",
            mediaType: "application/pdf",
            text: "Revenue rose in the northwind region",
            cut: false,
          },
        },
        { type: "text", text: "What changed?" },
      ],
    })
  )
  expect(search("sunrise")).toContain(question)
  expect(search("quarterly report")).toContain(question)
  expect(search("v12")).toContain(question)
  expect(search("What changed")).toContain(question)
  expect(search("northwind")).not.toContain(question)
})

test("a file name is found by the words inside a CamelCase or IMG4021 name", () => {
  const question = holding(
    wordsOf({
      id: "q",
      role: "user",
      parts: [
        {
          type: "file",
          mediaType: "image/jpeg",
          filename: "IMG4021.jpg",
          url: "data:image/jpeg;base64,AA==",
        },
        {
          type: "data-document",
          data: {
            name: "PackingList.md",
            mediaType: "text/plain",
            text: "Water",
            cut: false,
          },
        },
      ],
    })
  )
  expect(search("list")).toContain(question)
  expect(search("packinglist")).toContain(question)
  expect(search("4021")).toContain(question)
  expect(search("img4021")).toContain(question)
  expect(search("water")).not.toContain(question)
})

// A long chat is written in several statements: each piece is JSON under
// the limit, and together the pieces hold every row, in order.
it.prop([
  fc.array(fc.record({ id: fc.uuid(), text: fc.string({ maxLength: 200 }) })),
  fc.integer({ min: 300, max: 2000 }),
])("splits rows into pieces under the limit, losing none", (rows, max) => {
  const chunks = jsonChunks(rows, max)
  const parsed: unknown[][] = chunks.map((chunk) => JSON.parse(chunk))
  expect(parsed.flat()).toEqual(rows)
  chunks.forEach((chunk, at) => {
    // A row bigger than the limit goes alone; any other piece fits.
    expect(parsed[at]?.length === 1 || chunk.length <= max).toBe(true)
  })
})

test("a chat of no rows needs no statement", () => {
  expect(jsonChunks([])).toEqual([])
})
