// What the Library's page and its server share about its files: an
// item's shape, the tabs, orders and page size, and where the browser
// gets a file. Apart from the index (src/lib/chat/library.ts), so a page
// that only names a tab never loads Drizzle: the route's search check
// runs in the app's first load.

export const ATTACHMENT_KINDS = ["image", "pdf", "text"] as const
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number]

/** A file the Library lists. */
export type LibraryItem = {
  seq: number
  chatId: string
  messageId: string
  part: number
  name: string
  kind: AttachmentKind
  size: number
  at: number
}

/** Where the Library is in its list: the last item it has. */
type LibraryCursor = { at: number; seq: number }

/** The Library's tabs: every file, images, or documents. */
export const LIBRARY_TABS = ["all", "images", "files"] as const
export type LibraryTab = (typeof LIBRARY_TABS)[number]

export const LIBRARY_ORDERS = ["newest", "oldest"] as const
export type LibraryOrder = (typeof LIBRARY_ORDERS)[number]

/** What the Library shows: a tab, a part of a file name, an order, and
 *  where the next page starts. */
export type LibraryQuery = {
  tab: LibraryTab
  name: string
  order: LibraryOrder
  cursor?: LibraryCursor
}

/** How many items one page of the Library holds. */
export const LIBRARY_PAGE = 60

/** The place `step` away from `at` among `length` items, going round
 *  from the last to the first and back: the viewer's next and previous. */
export const stepAround = (at: number, step: number, length: number) =>
  length === 0 ? 0 : (((at + step) % length) + length) % length

/** A name to save a file under: a PDF's text is what the chat kept, so
 *  it saves as text. */
export const downloadName = (item: Pick<LibraryItem, "name" | "kind">) =>
  item.kind === "pdf" ? `${item.name}.txt` : item.name

/** Where the browser gets a file the Library shows (an image's bytes, or
 *  a document's text): from its chat's
 *  agent (ChatAgent.onRequest, src/lib/chat/agent.ts), behind the chats'
 *  door, by its message and part. `v` is the row's seq, which the server
 *  doesn't read: it makes the address change with the file (a changed
 *  file is a new row, and seq is never reused), so the browser can keep
 *  what it got for good. */
export const fileUrl = (item: LibraryItem) =>
  `/api/chats/${item.chatId}/files/${item.messageId}/${item.part}?v=${item.seq}`
