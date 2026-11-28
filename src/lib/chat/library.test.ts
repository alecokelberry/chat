import { readdirSync, readFileSync } from "node:fs"
import { DatabaseSync, type SQLInputValue } from "node:sqlite"

import { fc, it } from "@fast-check/vitest"
import type { UIMessage } from "ai"
import { drizzle } from "drizzle-orm/sqlite-proxy"
import { beforeEach, expect, test } from "vitest"

import {
  attachmentsOf,
  attachmentStatements,
  LIBRARY_PAGE,
  listAttachments,
  type AttachmentRow,
  type LibraryQuery,
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

/** The Library's query, through Drizzle over the same SQLite. */
const proxy = drizzle(async (sql, params, method) => {
  const statement = db.prepare(sql)
  const values = params.filter(isInput)
  if (method === "run") {
    statement.run(...values)
    return { rows: [] }
  }
  return {
    rows: statement.all(...values).map((row) => Object.values(row)),
  }
})

const list = (query: Partial<LibraryQuery> = {}) =>
  listAttachments(proxy, "u", {
    tab: "all",
    name: "",
    order: "newest",
    ...query,
  })

/** `count` questions, each with an image then a PDF, a second apart. */
function fill(count: number) {
  index(
    Array.from({ length: count }, (_, at) => [
      question(`q${at}`, [image(`Photo${at}.jpg`), doc(`Plan-${at}.pdf`)]),
      reply(`r${at}`, 10_000 + at * 1000),
    ]).flat()
  )
}

test("the Library lists newest first, by tab, by part of a name in any case", async () => {
  fill(3)
  expect((await list()).map((item) => item.name)).toEqual([
    "Plan-2.pdf",
    "Photo2.jpg",
    "Plan-1.pdf",
    "Photo1.jpg",
    "Plan-0.pdf",
    "Photo0.jpg",
  ])
  expect((await list({ tab: "images" })).map((item) => item.kind)).toEqual([
    "image",
    "image",
    "image",
  ])
  expect((await list({ tab: "files" })).map((item) => item.name)).toEqual([
    "Plan-2.pdf",
    "Plan-1.pdf",
    "Plan-0.pdf",
  ])
  expect((await list({ name: "PHOTO1" })).map((item) => item.name)).toEqual([
    "Photo1.jpg",
  ])
  expect(await list({ name: "%" })).toEqual([])
  expect((await list({ order: "oldest" })).at(0)?.name).toBe("Photo0.jpg")
})

test("Files holds PDFs and text files; a name folds A to Z as SQLite does", async () => {
  index([
    question("q1", [doc("PackingList.md", "text/markdown"), doc("École.pdf")]),
    reply("r1", 5000),
  ])
  expect((await list({ tab: "files" })).map((item) => item.kind)).toEqual([
    "pdf",
    "text",
  ])
  expect((await list({ name: "packing" })).map((item) => item.name)).toEqual([
    "PackingList.md",
  ])
  expect((await list({ name: "COLE" })).map((item) => item.name)).toEqual([
    "École.pdf",
  ])
  expect((await list({ name: "É" })).map((item) => item.name)).toEqual([
    "École.pdf",
  ])
})

test("pages follow on from the last item, in either order, with none twice", async () => {
  fill(LIBRARY_PAGE)
  for (const order of ["newest", "oldest"] as const) {
    const seen: number[] = []
    let page = await list({ order })
    while (page.length > 0) {
      seen.push(...page.map((item) => item.seq))
      const last = page.at(-1)
      page =
        last === undefined
          ? []
          : await list({ order, cursor: { at: last.at, seq: last.seq } })
    }
    expect(seen).toHaveLength(LIBRARY_PAGE * 2)
    expect(new Set(seen).size).toBe(seen.length)
  }
})
