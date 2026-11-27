// MessageScroller: the chat thread's scroller, on ui-sdk's ScrollArea with
// the browser's own thin scrollbars (app.css). Ported from the archived
// Chat. It opens a saved chat at its last question (a MessageScrollerItem
// with `anchor`), so a long reply reads from its start, and brings each new
// question to the top as it's sent, the reply growing under it. A spacer at
// the end lets the last question reach the top while its reply is short.
// The view holds the question there while the turns above it render, until
// you scroll. As in the archive, that's 80px from the screen's top: under
// the title pill on a computer, 24px under the header row on a phone. While more of the reply is below the view, ui-sdk's
// jump-to-latest button floats 12px above the composer.
import * as React from "react"
import {
  ScrollArea,
  ScrollAreaContent,
  ScrollAreaScrollToEnd,
  ScrollAreaViewport,
} from "@ui-sdk/react/scroll-area"
import { ChevronDownIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function MessageScroller({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof ScrollAreaViewport>, "children"> & {
  children: React.ReactNode
}) {
  const viewport = React.useRef<HTMLDivElement>(null)
  const content = React.useRef<HTMLDivElement>(null)
  const spacer = React.useRef<HTMLDivElement>(null)
  const letGo = useAnchors(viewport, content, spacer)

  return (
    <ScrollArea className={cn("relative flex min-h-0 flex-col", className)}>
      <ScrollAreaViewport
        ref={viewport}
        className="size-full min-h-0 scrollbar-gutter-stable overflow-y-auto overscroll-contain outline-hidden"
        {...props}
      >
        <ScrollAreaContent
          ref={content}
          className="mx-auto flex h-max min-h-full w-full max-w-composer flex-col gap-6 px-2 pt-6 pb-6 sm:px-6 md:pt-header-content"
        >
          {children}
          <div ref={spacer} aria-hidden className="-mt-6 shrink-0" />
        </ScrollAreaContent>
      </ScrollAreaViewport>
      {/* ui-sdk's jump to latest: inert at the end, shown once the view
          moves away, instant under reduced motion. The end is the reply's
          end: past a long reply the spacer is empty, and beside a short
          one the end is where the question sits at the top. Grok's place:
          centered over the column, 12px above the composer. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
        <ScrollAreaScrollToEnd
          aria-label="Jump to latest"
          onClick={letGo}
          className={buttonVariants({
            variant: "float",
            size: "circle",
            className:
              "pointer-events-none opacity-0 transition-[opacity,translate,scale] duration-menu ease-decelerate data-visible:pointer-events-auto data-visible:opacity-100 motion-safe:translate-y-full motion-safe:scale-95 motion-safe:data-visible:translate-y-0 motion-safe:data-visible:scale-100",
          })}
        >
          <ChevronDownIcon />
        </ScrollAreaScrollToEnd>
      </div>
    </ScrollArea>
  )
}

function useAnchors(
  viewport: React.RefObject<HTMLDivElement | null>,
  content: React.RefObject<HTMLDivElement | null>,
  spacer: React.RefObject<HTMLDivElement | null>
) {
  const lastAnchor = React.useRef<Element | null>(null)
  // Whether the view keeps the last question at the top while things
  // resize (turns above it settle their heights as they render), until the
  // user scrolls or jumps to the latest.
  const holding = React.useRef(true)
  const letGo = React.useCallback(() => {
    holding.current = false
  }, [])

  React.useLayoutEffect(() => {
    const view = viewport.current
    const body = content.current
    const pad = spacer.current
    if (!view || !body || !pad) return

    // Where the view sits with the anchor at the top.
    const topOf = (anchor: HTMLElement) =>
      anchor.offsetTop - parseFloat(getComputedStyle(body).paddingTop)

    // Size the spacer so the last question can reach the top, and keep it
    // there until the user scrolls. A new question goes there at once:
    // sending never animates (DESIGN.md › Motion).
    const placeLastQuestion = () => {
      const anchors = body.querySelectorAll<HTMLElement>("[data-anchor]")
      const anchor = anchors[anchors.length - 1]
      if (!anchor) return
      const without = body.scrollHeight - pad.offsetHeight
      pad.style.height = `${Math.max(0, topOf(anchor) + view.clientHeight - without)}px`
      if (anchor !== lastAnchor.current) holding.current = true
      lastAnchor.current = anchor
      if (holding.current)
        view.scrollTo({ top: topOf(anchor), behavior: "instant" })
    }

    placeLastQuestion()
    const observer = new ResizeObserver(placeLastQuestion)
    observer.observe(view)
    observer.observe(body)
    const mutations = new MutationObserver(placeLastQuestion)
    mutations.observe(body, { childList: true })
    const events = ["wheel", "touchmove", "keydown", "pointerdown"]
    for (const type of events)
      view.addEventListener(type, letGo, { passive: true })
    return () => {
      observer.disconnect()
      mutations.disconnect()
      for (const type of events) view.removeEventListener(type, letGo)
    }
  }, [viewport, content, spacer, letGo])
  return letGo
}

// One turn. `anchor` marks a question the view can bring to the top.
function MessageScrollerItem({
  anchor = false,
  className,
  ...props
}: React.ComponentProps<"div"> & { anchor?: boolean }) {
  return (
    <div
      data-anchor={anchor || undefined}
      // Turns out of view skip rendering (offscreen-turn, app.css); the 8px
      // bleed keeps fills that sit just outside the text whole.
      className={cn(
        "-mx-2 flex min-w-0 shrink-0 flex-col px-2 offscreen-turn",
        className
      )}
      {...props}
    />
  )
}

export { MessageScroller, MessageScrollerItem }
