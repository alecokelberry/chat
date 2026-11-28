import { readdirSync, readFileSync } from "node:fs"
import { DatabaseSync, type SQLInputValue } from "node:sqlite"

import { fc, it } from "@fast-check/vitest"
import type { UIMessage } from "ai"
import { beforeEach, expect, test } from "vitest"

import {
  attachmentsOf,
  attachmentStatements,
  type AttachmentRow,
} from "@/lib/chat/library"

// The Library's rows against a real SQLite: D1 is SQLite, so the app's own
// migrations run in Node's built-in SQLite, and its statements run there
// as they would in D1.
let db: DatabaseSync

beforeEach(() => {
  db = new DatabaseSync(":memory:")
  for (const file of readdirSync("migrations")
    .filter((name) => name.endsWith(".sql"))
    .toSorted())
    db.exec(readFileSync(`migrations/${file}`, "utf8"))
  db.exec(
    "insert into user (id, name, email, emailVerified, createdAt, updatedAt) values ('u', 'U', 'u@x', 0, 0, 0)"
  )
  db.exec(
    "insert into chat (userId, id, createdAt, updatedAt) values ('u', 'c', 1000, 1000)"
  )
})

const isInput = (value: unknown): value is SQLInputValue =>
  typeof value === "string" || typeof value === "number"

/** Brings the chat's rows up to `messages`, `changed` being the ones whose
 *  attachments are written, as indexMessages does. */
function index(messages: UIMessage[], changed = messages) {
  const statements = attachmentStatements(
    { userId: "u", id: "c" },
    messages,
    changed
  )
  for (const { sql, params } of statements)
    db.prepare(sql).run(...params.filter(isInput))
}

const rows = () =>
  db
    .prepare(
      "select seq, messageId, part, name, kind, size, at from attachment order by seq"
    )
    .all()

const image = (filename: string, base64 = "AAAA") =>
  ({
    type: "file",
    mediaType: "image/jpeg",
    filename,
    url: `data:image/jpeg;base64,${base64}`,
  }) as const

const doc = (name: string, mediaType = "application/pdf") =>
  ({
    type: "data-document",
    data: { name, mediaType, text: "hello", cut: false },
  }) as const

const question = (id: string, parts: UIMessage["parts"]): UIMessage => ({
  id,
  role: "user",
  parts,
})

const reply = (id: string, started?: number): UIMessage => ({
  id,
  role: "assistant",
  metadata: started === undefined ? undefined : { started },
  parts: [{ type: "text", text: "Sure" }],
})

test("a question's images and documents become rows, timed by its reply", () => {
  index([
    question("q1", [
      { type: "text", text: "Look" },
      image("trail.jpg"),
      doc("plan.pdf"),
      doc("notes.md", "text/markdown"),
    ]),
    reply("r1", 5000),
  ])
  expect(rows()).toMatchObject([
    { messageId: "q1", part: 1, name: "trail.jpg", kind: "image", size: 3 },
    { messageId: "q1", part: 2, name: "plan.pdf", kind: "pdf", size: 5 },
    { messageId: "q1", part: 3, name: "notes.md", kind: "text", at: 5000 },
  ])
})

test("a question with no reply time takes the chat's start", () => {
  index([question("q1", [image("a.jpg")])])
  expect(rows()).toMatchObject([{ at: 1000 }])
})

test("indexing again keeps an unchanged file's row", () => {
  const chat = [question("q1", [image("a.jpg")]), reply("r1", 5000)]
  index(chat)
  const before = rows()
  index(chat)
  expect(rows()).toEqual(before)
})

test("an edit that swaps a file replaces its row; a removed one goes", () => {
  index([question("q1", [image("a.jpg"), image("b.jpg")]), reply("r1", 5000)])
  const [first] = rows()
  const edited = question("q1", [image("a.jpg", "BBBBBBBB")])
  index([edited, reply("r2", 6000)], [edited])
  const after = rows()
  expect(after).toHaveLength(1)
  expect(after[0]).toMatchObject({ name: "a.jpg", size: 6 })
  expect(after[0]?.seq).not.toBe(first?.seq)
})

test("a message the chat no longer holds loses its rows", () => {
  index([question("q1", [image("a.jpg")]), question("q2", [image("b.jpg")])])
  index([question("q2", [image("b.jpg")])], [])
  expect(rows()).toMatchObject([{ messageId: "q2" }])
})

test("deleting the chat deletes its rows", () => {
  db.exec("pragma foreign_keys = on")
  index([question("q1", [image("a.jpg")])])
  db.exec("delete from chat where id = 'c'")
  expect(rows()).toEqual([])
})

const part = fc.oneof(
  fc.string().map((name) => image(name)),
  fc.string().map((name) => doc(name)),
  fc.string().map((text) => ({ type: "text", text }) as const)
)

it.prop([
  fc.array(
    fc.record({
      role: fc.constantFrom("user", "assistant", "system"),
      parts: fc.array(part, { maxLength: 6 }),
    }),
    { maxLength: 8 }
  ),
])(
  "one row per image or document a question holds, none from replies or text",
  (messages) => {
    const chat: UIMessage[] = messages.map((message, at) => ({
      id: `m${at}`,
      ...message,
    }))
    const expected = chat
      .filter((message) => message.role === "user")
      .flatMap((message) =>
        message.parts.flatMap((p, at) =>
          p.type === "text" ? [] : [{ messageId: message.id, part: at }]
        )
      )
    expect(
      attachmentsOf(chat).map(({ messageId, part }: AttachmentRow) => ({
        messageId,
        part,
      }))
    ).toEqual(expected)
  }
)
