// The Library: every image and document attached to a question, across
// all the signed-in user's chats, laid out like Grok's Library page: its
// heading, tabs (All, Images, Files), a search box, a Grid/List switch and
// an options button (Order: Newest or Oldest), then the files under the
// sidebar's day groups (src/lib/chat/groups.ts) in the browser's own time
// zone, so the list renders only in the browser. The tab and what's typed
// live in the address (?tab=&q=), so back and reload keep them; the view
// and order are remembered on the device (src/lib/library-view.ts), so
// the server renders them with no flash. The list comes from the
// attachment index (getLibrary, src/lib/chat/library.ts) a page at a
// time, the next page loading as the end of the list scrolls into view.
// The Grid shows each image as a square (from its chat's agent, fileUrl)
// and each document as a tile with its icon, name and kind; the List
// shows a row with a thumbnail, its name and kind, and how long ago it
// was sent. Either opens the chat it came from. A chat being deleted
// takes its files with it at once, and Undo brings them back, as in the
// sidebar's list. As the page opens it has a few chats the index doesn't
// hold yet index themselves, as Search does, and loads the list again if
// any did, so older chats fill in. In dev, ?data=worst|empty|one swaps
// the files for made-up extremes (src/lib/dev/worst-case.ts).
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
  useSearch,
} from "@tanstack/react-router"
import {
  FileTextIcon,
  ImageOffIcon,
  LayoutGridIcon,
  ListIcon,
  SearchIcon,
  Settings2Icon,
} from "lucide-react"

import { useChatList } from "@/components/chat/chat-list"
import {
  DocumentReader,
  FileActions,
  LibraryViewer,
} from "@/components/chat/library-viewer"
import { Button } from "@/components/ui/button"
import { FileName } from "@/components/ui/file-chip"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import { Toggle, ToggleGroup, ToggleIcon } from "@/components/ui/toggle"
import {
  Menu,
  MenuContent,
  MenuGroupLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@/components/ui/menu"
import { groupByDay } from "@/lib/chat/groups"
import {
  fileUrl,
  LIBRARY_ORDERS,
  LIBRARY_PAGE,
  LIBRARY_TABS,
  type LibraryItem,
  type LibraryOrder,
  type LibraryQuery,
  type LibraryTab,
} from "@/lib/chat/library-items"
import { getLibrary, indexOlderChats, NAME_MAX } from "@/lib/chat/list"
import { relativeTime } from "@/lib/chat/relative-time"
import { previewLibrary } from "@/lib/dev/worst-case"
import {
  libraryLook,
  saveLibraryLook,
  type LibraryView,
} from "@/lib/library-view"
import { pageTitle } from "@/lib/utils"

type LibrarySearch = { tab?: LibraryTab; q?: string }

type Query = Omit<LibraryQuery, "cursor">

const oneOf = <T extends string>(values: readonly T[], value: unknown) =>
  values.find((known) => known === value)

export const Route = createFileRoute("/_app/library")({
  head: () => ({ meta: [{ title: pageTitle("Library") }] }),
  // Only what differs from the default goes in the address.
  validateSearch: (search: Record<string, unknown>): LibrarySearch => ({
    tab: oneOf(LIBRARY_TABS.slice(1), search.tab),
    q:
      typeof search.q === "string" && search.q !== ""
        ? search.q.slice(0, NAME_MAX)
        : undefined,
  }),
  loaderDeps: ({ search }) => ({
    tab: search.tab ?? "all",
    name: search.q ?? "",
  }),
  // The order comes from the saved look; a change saves it and loads again.
  loader: async ({ deps }) => {
    const query: Query = { ...deps, order: libraryLook().order }
    return { query, items: await getLibrary({ data: query }) }
  },
  component: Library,
})

/** Each tab's name, and what it says with nothing to show. */
const TABS: Record<
  LibraryTab,
  { label: string; empty: { title: string; body: string } }
> = {
  all: {
    label: "All",
    empty: {
      title: "Your library is empty",
      body: "Files you attach in a chat show up here.",
    },
  },
  images: {
    label: "Images",
    empty: {
      title: "No images yet",
      body: "Photos you attach in a chat show up here.",
    },
  },
  files: {
    label: "Files",
    empty: {
      title: "No files yet",
      body: "PDFs and text files you attach in a chat show up here.",
    },
  },
}

const KIND = { image: "Image", pdf: "PDF", text: "Text" } as const

/** How long typing pauses before the list asks for what was typed. */
const TYPING_PAUSE = 250

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
  const { query, items } = Route.useLoaderData()
  // From the cookie as the page mounts (the request's on the server, the
  // browser's own after), not the loader's data, which Back may serve
  // from before a switch. Shown at once; the order needs the list loaded
  // again.
  const [view, setView] = useState(() => libraryLook().view)
  const shown = useMemo(() => previewLibrary(items, data), [items, data])
  const navigate = useNavigate({ from: Route.fullPath })
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
        <Tabs value={query.tab}>
          <TabsList aria-label="Show" className="mx-3 mb-3">
            {LIBRARY_TABS.map((tab) => (
              <TabsTab
                key={tab}
                value={tab}
                render={
                  <Link
                    from={Route.fullPath}
                    search={(prev) => ({
                      ...prev,
                      tab: tab === "all" ? undefined : tab,
                    })}
                  />
                }
              >
                {TABS[tab].label}
              </TabsTab>
            ))}
          </TabsList>
          <TabsPanel value={query.tab}>
            <div className="flex items-center justify-end gap-2 px-3 pb-3">
              <NameSearch
                name={query.name}
                onChange={(name) =>
                  void navigate({
                    search: (prev) => ({ ...prev, q: name || undefined }),
                    replace: true,
                  })
                }
              />
              <ViewSwitch
                view={view}
                onView={(picked) => {
                  saveLibraryLook({ view: picked, order: query.order })
                  setView(picked)
                }}
              />
              <Options
                order={query.order}
                onOrder={(order) => {
                  saveLibraryLook({ view, order })
                  void router.invalidate()
                }}
              />
            </div>
            <Files
              // A new tab, name or order starts the list over.
              key={JSON.stringify(query)}
              first={shown}
              query={query}
              view={view}
              more={data === undefined}
            />
          </TabsPanel>
        </Tabs>
      </div>
    </main>
  )
}

/** Grok's search box: a muted, rounded field with its glyph, filtering
 *  by file name as typing pauses. */
function NameSearch({
  name,
  onChange,
}: {
  name: string
  onChange: (name: string) => void
}) {
  const [typed, setTyped] = useState(name)
  // What the address last held or was sent: a name it gets from
  // elsewhere (Back, or the sidebar's Library) replaces what's typed.
  const [sent, setSent] = useState(name)
  if (name !== sent) {
    setSent(name)
    setTyped(name)
  }
  useEffect(() => {
    if (typed === sent) return
    const timer = setTimeout(() => {
      setSent(typed)
      onChange(typed)
    }, TYPING_PAUSE)
    return () => clearTimeout(timer)
  }, [typed, sent, onChange])
  return (
    <div className="flex h-9 w-full max-w-60 items-center gap-2 rounded-lg border border-border bg-secondary px-3 text-muted-foreground focus-within:ring-2 focus-within:ring-ring [&_svg]:size-4 [&_svg]:shrink-0">
      <SearchIcon aria-hidden />
      <Input
        type="search"
        aria-label="Search files"
        placeholder="Search…"
        maxLength={NAME_MAX}
        value={typed}
        onChange={(event) => setTyped(event.currentTarget.value)}
      />
    </div>
  )
}

/** Grid or List, shown at once. */
function ViewSwitch({
  view,
  onView,
}: {
  view: LibraryView
  onView: (view: LibraryView) => void
}) {
  return (
    <ToggleGroup<LibraryView>
      aria-label="View"
      value={[view]}
      deselectable={false}
      onValueChange={([pressed]) => {
        if (pressed !== undefined) onView(pressed)
      }}
    >
      <Toggle value="grid" aria-label="Grid">
        <ToggleIcon>
          <LayoutGridIcon />
        </ToggleIcon>
      </Toggle>
      <Toggle value="list" aria-label="List">
        <ToggleIcon>
          <ListIcon />
        </ToggleIcon>
      </Toggle>
    </ToggleGroup>
  )
}

/** Grok's view options button: the order. */
function Options({
  order,
  onOrder,
}: {
  order: LibraryOrder
  onOrder: (order: LibraryOrder) => void
}) {
  return (
    <Menu>
      <MenuTrigger render={<Button size="header" aria-label="View options" />}>
        <Settings2Icon aria-hidden />
      </MenuTrigger>
      <MenuContent align="end">
        <MenuRadioGroup
          value={order}
          onValueChange={(value) => {
            const picked = oneOf(LIBRARY_ORDERS, value)
            if (picked !== undefined) onOrder(picked)
          }}
        >
          <MenuGroupLabel>Order</MenuGroupLabel>
          <MenuRadioItem value="newest" closeOnSelect>
            Newest
          </MenuRadioItem>
          <MenuRadioItem value="oldest" closeOnSelect>
            Oldest
          </MenuRadioItem>
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  )
}

/** Grok's empty card. */
function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-3 rounded-xl border border-border px-4 py-3">
      <p className="text-base">{title}</p>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

function Nothing({ query }: { query: Query }) {
  if (query.name !== "")
    return (
      <Empty title="No files found">No file name holds “{query.name}”.</Empty>
    )
  const { title, body } = TABS[query.tab].empty
  return <Empty title={title}>{body}</Empty>
}

/** The list: `first`, the loader's page, then each next page as the end
 *  comes into view, while pages come back full and `more` allows. */
function Files({
  first,
  query,
  view,
  more,
}: {
  first: LibraryItem[]
  query: Query
  view: LibraryView
  more: boolean
}) {
  const inBrowser = useInBrowser()
  // Only the files of chats in the list: a chat being deleted leaves it
  // at once, with Undo in its toast, before the server deletes it.
  const { chats } = useChatList()
  const [loadedItems, setItems] = useState(first)
  const [done, setDone] = useState(!more || first.length < LIBRARY_PAGE)
  // A reload of the list (older chats just indexed) starts it over.
  const [loaded, setLoaded] = useState(first)
  if (first !== loaded) {
    setLoaded(first)
    setItems(first)
    setDone(!more || first.length < LIBRARY_PAGE)
  }
  // The image open in the viewer (its seq), or the document in the reader.
  const [viewing, setViewing] = useState<number | null>(null)
  const [reading, setReading] = useState<LibraryItem | null>(null)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const sentinel = end.current
    const last = loadedItems.at(-1)
    if (done || sentinel === null || last === undefined) return
    let loading = false
    // A list started over (older chats just indexed) drops this page.
    let stale = false
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting !== true || loading) return
      loading = true
      getLibrary({
        data: { ...query, cursor: { at: last.at, seq: last.seq } },
      }).then(
        (page) => {
          if (stale) return
          setItems((had) => [...had, ...page])
          if (page.length < LIBRARY_PAGE) setDone(true)
        },
        (error: unknown) => {
          // Tried again when the end comes back into view.
          console.error("Couldn't load more of the Library", error)
          loading = false
        }
      )
    })
    observer.observe(sentinel)
    return () => {
      stale = true
      observer.disconnect()
    }
  }, [loadedItems, done, query])
  const listed = new Set(chats.map((chat) => chat.id))
  const items = loadedItems.filter((item) => listed.has(item.chatId))
  // Files only of chats being deleted still leave later pages to load.
  if (items.length === 0 && done) return <Nothing query={query} />
  if (!inBrowser) return null
  const now = Date.now()
  const byDay = groupByDay(items, (item) => item.at, now)
  const groups = query.order === "oldest" ? byDay.toReversed() : byDay
  // The viewer pages through the images as the page lists them.
  const images = groups
    .flatMap((group) => group.items)
    .filter((item) => item.kind === "image")
  const at = images.findIndex((item) => item.seq === viewing)
  const open = (item: LibraryItem) =>
    item.kind === "image" ? setViewing(item.seq) : setReading(item)
  return (
    <>
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label} className="pb-3">
          <h2 className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">
            {group.label}
          </h2>
          {view === "grid" ? (
            <ul className="grid grid-cols-3 gap-2 px-3 sm:grid-cols-4 md:grid-cols-5">
              {group.items.map((item) => (
                <li key={item.seq} className="group/file relative">
                  <Tile item={item} onOpen={() => open(item)} />
                  <FileActions
                    item={item}
                    variant="overlay"
                    className="absolute end-1.5 top-1.5"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="flex flex-col gap-px">
              {group.items.map((item) => (
                <li key={item.seq} className="flex items-center gap-1">
                  <Row item={item} now={now} onOpen={() => open(item)} />
                  <FileActions item={item} className="me-1.5" />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {!done && <div ref={end} className="h-px" />}
      <LibraryViewer
        images={images}
        at={at === -1 ? null : at}
        onAt={(next) => setViewing(images[next]?.seq ?? null)}
        onClose={() => setViewing(null)}
      />
      <DocumentReader item={reading} onClose={() => setReading(null)} />
    </>
  )
}

/** A file in the Grid: an image's square, or a document's tile with its
 *  icon, name and kind. An image's name is there for screen readers. */
function Tile({ item, onOpen }: { item: LibraryItem; onOpen: () => void }) {
  const [broken, setBroken] = useState(false)
  const image = item.kind === "image" && !broken
  return (
    <Button variant="tile" size="none" onClick={onOpen}>
      {image ? (
        <>
          <img
            src={fileUrl(item)}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
          />
          <span className="sr-only">
            {item.name}, {KIND[item.kind]}
          </span>
        </>
      ) : (
        <>
          <span className="text-muted-foreground">
            {item.kind === "image" ? (
              <ImageOffIcon aria-hidden />
            ) : (
              <FileTextIcon aria-hidden />
            )}
          </span>
          <span className="line-clamp-2 w-full text-xs font-medium break-all">
            {item.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {KIND[item.kind]}
          </span>
        </>
      )}
    </Button>
  )
}

function Row({
  item,
  now,
  onOpen,
}: {
  item: LibraryItem
  now: number
  onOpen: () => void
}) {
  // An image that won't load (its chat deleted since) shows the icon the
  // thread shows for one, not the browser's broken image.
  const [broken, setBroken] = useState(false)
  return (
    <Button
      variant="file"
      size="none"
      className="min-w-0 flex-1"
      onClick={onOpen}
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
