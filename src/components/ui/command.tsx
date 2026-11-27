// Command: ui-sdk's command list (a search field over an always-shown
// listbox: typing filters and ranks, arrow keys move the highlight, Enter
// runs or follows it, focus stays in the field) with the sidebar's look.
// The field is a 56px row with a muted search glyph, 15px (16px on touch
// screens, so iOS never zooms), over a hairline; groups are labelled like
// the sidebar's (12px medium muted); rows are 40px with 12px corners in
// secondary ink, washed and full ink while highlighted, the search's
// matched letters in medium full ink. The list scrolls on its own,
// without chaining to the page. A long flat list renders only the rows in
// view (CommandWindow, ui-sdk's virtualized Command): ui-sdk still ranks
// and arrows through every item, mounted or not, and useCommandWindow
// scrolls the highlighted one into view.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import type * as React from "react"
import { SearchIcon } from "lucide-react"
import {
  Command,
  CommandEmpty as CommandEmptyPrimitive,
  CommandGroup as CommandGroupPrimitive,
  CommandGroupLabel as CommandGroupLabelPrimitive,
  CommandInput as CommandInputPrimitive,
  CommandItem as CommandItemPrimitive,
  CommandItemText as CommandItemTextPrimitive,
  CommandList as CommandListPrimitive,
  type CommandData,
  type CommandDataItem,
} from "@ui-sdk/react/command"

import { cn } from "@/lib/utils"

/** The search field, led by its glyph. */
function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandInputPrimitive>) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
      <SearchIcon
        aria-hidden
        className="size-icon shrink-0 text-muted-foreground"
      />
      <CommandInputPrimitive
        className={cn(
          "min-w-0 flex-1 bg-transparent field-text text-foreground outline-hidden placeholder:text-muted-foreground",
          className
        )}
        {...props}
      />
    </div>
  )
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandListPrimitive>) {
  return (
    <CommandListPrimitive
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 empty:hidden",
        className
      )}
      {...props}
    />
  )
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandGroupPrimitive>) {
  return (
    <CommandGroupPrimitive
      className={cn("flex flex-col gap-px pb-1", className)}
      {...props}
    />
  )
}

function CommandGroupLabel({
  className,
  ...props
}: React.ComponentProps<typeof CommandGroupLabelPrimitive>) {
  return (
    <CommandGroupLabelPrimitive
      className={cn(
        "px-3 pt-2.5 pb-1 text-xs font-medium text-sidebar-muted select-none",
        className
      )}
      {...props}
    />
  )
}

function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof CommandItemPrimitive>) {
  return (
    <CommandItemPrimitive
      className={cn(
        "flex h-10 shrink-0 items-center rounded-item px-3 text-base text-ink-secondary outline-hidden select-none highlighted:bg-accent highlighted:text-foreground [&>span]:min-w-0 [&>span]:flex-1 [&>span]:truncate",
        className
      )}
      {...props}
    />
  )
}

/** The command's label, the letters the search matched in medium full
 *  ink. */
function CommandItemText() {
  return (
    <CommandItemTextPrimitive dir="auto">
      {(text) =>
        text.segments.map((segment, index) =>
          segment.match ? (
            <strong key={index} className="font-medium text-foreground">
              {segment.text}
            </strong>
          ) : (
            segment.text
          )
        )
      }
    </CommandItemTextPrimitive>
  )
}

declare module "react" {
  interface CSSProperties {
    /** A CommandWindow's height: all its rows'. */
    "--window-height"?: string
    /** Where a CommandWindow's row sits. */
    "--row-top"?: string
  }
}

/** A row's pitch in a window: its 40px and the 1px gap. */
const ROW = 41
/** Rows rendered beyond each edge of the view. */
const OVERSCAN = 8

/** The scrolled list a CommandWindow renders into: pass `list` as the
 *  CommandList's ref, and `reveal` the index Command's onValueChange
 *  gives, so a highlight moved by the keyboard scrolls into view. */
function useCommandWindow() {
  const list = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ top: 0, height: 0 })
  useEffect(() => {
    const element = list.current
    if (element === null) return
    const update = () =>
      setView({ top: element.scrollTop, height: element.clientHeight })
    update()
    element.addEventListener("scroll", update, { passive: true })
    const resize = new ResizeObserver(update)
    resize.observe(element)
    return () => {
      element.removeEventListener("scroll", update)
      resize.disconnect()
    }
  }, [])
  const reveal = useCallback((index: number) => {
    const element = list.current
    if (element === null || index < 0) return
    const top = index * ROW
    const bottom = top + ROW + 2 * PAD
    if (top < element.scrollTop) element.scrollTop = top
    else if (bottom > element.scrollTop + element.clientHeight)
      element.scrollTop = bottom - element.clientHeight
  }, [])
  return { list, view, reveal }
}

/** The list's own padding, 6px, which a window's rows sit inside. */
const PAD = 6

/** The rows of `items` in view (and a few past), each placed at its
 *  index, inside a box as tall as all of them. `children` renders one,
 *  given its index among the results, for its CommandItem's `index`. */
function CommandWindow<T extends { value: string }>({
  items,
  view,
  children,
}: {
  items: readonly T[]
  view: { top: number; height: number }
  children: (item: T, index: number) => ReactNode
}) {
  const start = Math.max(0, Math.floor(view.top / ROW) - OVERSCAN)
  const end = Math.min(
    items.length,
    Math.ceil((view.top + view.height) / ROW) + OVERSCAN
  )
  return (
    <div
      className="relative h-(--window-height)"
      style={{ "--window-height": `${items.length * ROW}px` }}
    >
      {items.slice(start, end).map((item, offset) => (
        <div
          key={item.value}
          className="absolute inset-x-0 top-(--row-top)"
          style={{
            "--row-top": `${(start + offset) * ROW}px`,
          }}
        >
          {children(item, start + offset)}
        </div>
      ))}
    </div>
  )
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandEmptyPrimitive>) {
  return (
    <CommandEmptyPrimitive
      className={cn(
        "px-4 py-6 text-center text-sm text-muted-foreground empty:hidden",
        className
      )}
      {...props}
    />
  )
}

export {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandItemText,
  CommandList,
  CommandWindow,
  useCommandWindow,
  type CommandData,
  type CommandDataItem,
}
