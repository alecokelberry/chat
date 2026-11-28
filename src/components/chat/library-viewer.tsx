// The Library's viewer and reader, over the whole screen on a phone too.
// The viewer shows one of the Library's images at a time, as it lists
// them (its tab, search and order): ‹ and › at its sides, the arrow keys
// and a swipe go to the previous or next, round from the last to the
// first, and its top bar reads "name · 5 / 96" with Download, Open chat
// and Close. The reader shows a document's text, as the chat kept it,
// under the same bar. Each file in the Library also has a ⋯ menu (a sheet
// on a phone) with Download and Open chat. The file comes from its chat's
// agent (fileUrl); Download saves it under its name, a PDF as the text
// the chat kept of it (downloadName).
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  EllipsisIcon,
  MessageSquareIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  downloadName,
  fileUrl,
  stepAround,
  type LibraryItem,
} from "@/lib/chat/library-items"

/** How far a finger goes sideways before a swipe turns the page. */
const SWIPE = 48

/** An icon button in the bar, named by its tooltip. */
function BarAction({
  label,
  render,
  children,
}: {
  label: string
  render: React.ReactElement
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={render} aria-label={label}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** The top bar: the title, then Download, Open chat and Close. */
function Bar({
  item,
  children,
  onClose,
}: {
  item: LibraryItem
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 px-4">
      <DialogTitle className="flex min-w-0 flex-1">{children}</DialogTitle>
      <BarAction
        label="Download"
        render={
          <Button
            size="header"
            render={
              <a
                href={fileUrl(item)}
                download={downloadName(item)}
                aria-label="Download"
              />
            }
          />
        }
      >
        <DownloadIcon aria-hidden />
      </BarAction>
      <BarAction
        label="Open chat"
        render={
          <Button
            size="header"
            render={<Link to="/c/$id" params={{ id: item.chatId }} />}
          />
        }
      >
        <MessageSquareIcon aria-hidden />
      </BarAction>
      <BarAction
        label="Close"
        render={<Button size="header" onClick={onClose} />}
      >
        <XIcon aria-hidden />
      </BarAction>
    </div>
  )
}

/** One of `images` full screen, from `at`; `onAt` moves it. */
export function LibraryViewer({
  images,
  at,
  onAt,
  onClose,
}: {
  images: LibraryItem[]
  at: number | null
  onAt: (at: number) => void
  onClose: () => void
}) {
  const item = at === null ? undefined : images[at]
  const swipe = useRef<number | null>(null)
  const go = (step: number) => {
    if (at !== null) onAt(stepAround(at, step, images.length))
  }
  const many = images.length > 1
  return (
    <Dialog
      presentation="dialog"
      open={item !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        full
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") go(-1)
          else if (event.key === "ArrowRight") go(1)
        }}
      >
        {item !== undefined && at !== null && (
          <>
            <Bar item={item} onClose={onClose}>
              <span className="truncate text-sm font-medium">{item.name}</span>
              <span className="shrink-0 text-sm font-medium whitespace-pre text-muted-foreground tabular-nums">
                {` · ${at + 1} / ${images.length}`}
              </span>
            </Bar>
            <div
              className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center px-4 pb-4 select-none md:px-16"
              onPointerDown={(event) => {
                swipe.current = event.clientX
              }}
              onPointerUp={(event) => {
                const from = swipe.current
                swipe.current = null
                if (from === null || !many) return
                const moved = event.clientX - from
                if (Math.abs(moved) >= SWIPE) go(moved < 0 ? 1 : -1)
              }}
              onPointerCancel={() => {
                swipe.current = null
              }}
            >
              <img
                key={item.seq}
                src={fileUrl(item)}
                alt={item.name}
                draggable={false}
                className="max-h-full max-w-full object-contain"
              />
              {many && (
                <>
                  <Button
                    variant="float"
                    size="circle"
                    aria-label="Previous image"
                    className="absolute start-4 top-1/2 -translate-y-1/2"
                    onClick={() => go(-1)}
                  >
                    <ChevronLeftIcon aria-hidden />
                  </Button>
                  <Button
                    variant="float"
                    size="circle"
                    aria-label="Next image"
                    className="absolute end-4 top-1/2 -translate-y-1/2"
                    onClick={() => go(1)}
                  >
                    <ChevronRightIcon aria-hidden />
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

type Text =
  | { state: "loading" }
  | { state: "done"; text: string }
  | { state: "failed" }

/** A document's text, full screen. */
export function DocumentReader({
  item,
  onClose,
}: {
  item: LibraryItem | null
  onClose: () => void
}) {
  return (
    <Dialog
      presentation="dialog"
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent full>
        {item !== null && (
          <>
            <Bar item={item} onClose={onClose}>
              <span className="truncate text-sm font-medium">{item.name}</span>
            </Bar>
            {/* Keyed, so another document starts from loading. */}
            <DocumentText key={item.seq} item={item} />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DocumentText({ item }: { item: LibraryItem }) {
  const [text, setText] = useState<Text>({ state: "loading" })
  useEffect(() => {
    const controller = new AbortController()
    fetch(fileUrl(item), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.text()
      })
      .then(
        (loaded) => setText({ state: "done", text: loaded }),
        (error: unknown) => {
          if (controller.signal.aborted) return
          console.error("Couldn't open the document", error)
          setText({ state: "failed" })
        }
      )
    return () => controller.abort()
  }, [item])
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
      {text.state === "loading" ? (
        <div className="flex justify-center pt-12">
          <Spinner />
          <span className="sr-only">Opening {item.name}</span>
        </div>
      ) : text.state === "failed" ? (
        <p className="pt-12 text-center text-sm text-muted-foreground">
          This file couldn’t be opened. Try again, or open its chat.
        </p>
      ) : (
        <pre
          dir="auto"
          className="mx-auto max-w-composer font-sans text-sm break-words whitespace-pre-wrap"
        >
          {text.text}
        </pre>
      )}
    </div>
  )
}

/** A file's ⋯: Download and Open chat. */
export function FileActions({
  item,
  variant = "ghost",
  className,
}: {
  item: LibraryItem
  variant?: "ghost" | "overlay"
  className?: string
}) {
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant={variant}
            size="header"
            aria-label={`Actions for ${item.name}`}
            className={className}
          />
        }
      >
        <EllipsisIcon aria-hidden />
      </MenuTrigger>
      <MenuContent align="end">
        <MenuItem
          render={
            <a
              href={fileUrl(item)}
              download={downloadName(item)}
              aria-label="Download"
            />
          }
        >
          <DownloadIcon aria-hidden />
          Download
        </MenuItem>
        <MenuItem render={<Link to="/c/$id" params={{ id: item.chatId }} />}>
          <MessageSquareIcon aria-hidden />
          Open chat
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
