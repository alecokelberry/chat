// The Library: every image and document attached to a question, across
// all the signed-in user's chats, newest first, under the sidebar's day
// groups (src/lib/chat/groups.ts) in the browser's own time zone, so the
// list renders only in the browser. Laid out like Grok's Library page: its
// heading, then the files. Each row shows the image (from its chat's
// agent, src/lib/chat/library.ts's fileUrl) or a document's icon, its name
// and kind, and how long ago it was sent, and opens the chat it came from.
// A chat being deleted takes its files with it at once, and Undo brings
// them back, as in the sidebar's list.
// The list comes from the attachment index (getLibrary); as the page opens
// it has a few chats the index doesn't hold yet index themselves, as Search
// does, and loads the list again if any did, so older chats fill in.
// In dev, ?data=worst|empty|one swaps the files for made-up extremes
// (src/lib/dev/worst-case.ts).
import { useEffect, useState, useSyncExternalStore } from "react"
import {
  createFileRoute,
  Link,
  useRouter,
  useSearch,
} from "@tanstack/react-router"
import { FileTextIcon, ImageOffIcon } from "lucide-react"

import { useChatList } from "@/components/chat/chat-list"
import { Button } from "@/components/ui/button"
import { FileName } from "@/components/ui/file-chip"
import { groupByDay } from "@/lib/chat/groups"
import { fileUrl, type LibraryItem } from "@/lib/chat/library"
import { getLibrary, indexOlderChats } from "@/lib/chat/list"
import { relativeTime } from "@/lib/chat/relative-time"
import { previewLibrary } from "@/lib/dev/worst-case"
import { pageTitle } from "@/lib/utils"

export const Route = createFileRoute("/_app/library")({
  head: () => ({ meta: [{ title: pageTitle("Library") }] }),
  loader: () => getLibrary(),
  component: Library,
})

const KIND = { image: "Image", pdf: "PDF", text: "Text" } as const

const noSubscribe = () => () => {}

/** True in the browser once hydrated: the groups need its time zone. */
const useInBrowser = () =>
  useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false
  )

function Library() {
  const { data } = useSearch({ from: "/_app" })
  const items = previewLibrary(Route.useLoaderData(), data)
  // Only the files of chats in the list: a chat being deleted leaves it
  // at once, with Undo in its toast, before the server deletes it.
  const { chats } = useChatList()
  const listed = new Set(chats.map((chat) => chat.id))
  const shown = items.filter((item) => listed.has(item.chatId))
  const router = useRouter()
  useEffect(() => {
    void indexOlderChats().then((indexed) => {
      if (indexed > 0) void router.invalidate()
    })
  }, [router])
  return (
    <main
      id="main"
      tabIndex={-1}
      className="min-h-0 flex-1 overflow-y-auto px-3 pb-safe outline-hidden md:px-6"
    >
      <div className="mx-auto w-full max-w-composer pt-2 md:pt-12">
        <h1 className="px-3 pb-4 text-base font-medium">Library</h1>
        {shown.length === 0 ? <Empty /> : <Files items={shown} />}
      </div>
    </main>
  )
}

/** Grok's empty card, worded for files that come only from chats. */
function Empty() {
  return (
    <div className="mx-3 rounded-xl border border-border px-4 py-3">
      <p className="text-base">Your library is empty</p>
      <p className="text-sm text-muted-foreground">
        Files you attach in a chat show up here.
      </p>
    </div>
  )
}

function Files({ items }: { items: LibraryItem[] }) {
  const inBrowser = useInBrowser()
  if (!inBrowser) return null
  const now = Date.now()
  return groupByDay(items, (item) => item.at, now).map((group) => (
    <section key={group.label} aria-label={group.label} className="pb-3">
      <h2 className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">
        {group.label}
      </h2>
      <ul className="flex flex-col gap-px">
        {group.items.map((item) => (
          <li key={item.seq}>
            <Row item={item} now={now} />
          </li>
        ))}
      </ul>
    </section>
  ))
}

function Row({ item, now }: { item: LibraryItem; now: number }) {
  // An image that won't load (its chat deleted since) shows the icon the
  // thread shows for one, not the browser's broken image.
  const [broken, setBroken] = useState(false)
  return (
    <Button
      variant="file"
      size="none"
      render={<Link to="/c/$id" params={{ id: item.chatId }} />}
    >
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted text-muted-foreground [&_svg]:size-5">
        {item.kind === "image" && !broken ? (
          <img
            src={fileUrl(item)}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
            className="size-full object-cover"
          />
        ) : item.kind === "image" ? (
          <ImageOffIcon aria-hidden />
        ) : (
          <FileTextIcon aria-hidden />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <FileName name={item.name} />
        <span className="text-xs text-muted-foreground">{KIND[item.kind]}</span>
      </span>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {relativeTime(item.at, now)}
      </span>
    </Button>
  )
}
