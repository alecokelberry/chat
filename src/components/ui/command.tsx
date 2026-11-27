// Command: ui-sdk's command list (a search field over an always-shown
// listbox: typing filters and ranks, arrow keys move the highlight, Enter
// runs or follows it, focus stays in the field) with the sidebar's look.
// The field is a 56px row, 15px (16px on touch screens, so iOS never
// zooms), with an optional hint at its end (Grok's "Next section Tab"),
// over a hairline; groups are labelled like the sidebar's (12px medium
// muted); rows are 40px with 12px corners in secondary ink, an 18px icon
// 10px before the label and CommandItemEnd (a time, keycaps) at the end,
// washed and full ink while highlighted, the search's matched letters in
// medium full ink. The list scrolls on its own,
// without chaining to the page. A long flat list renders only the rows in
// view (CommandWindow, ui-sdk's virtualized Command): ui-sdk still ranks
// and arrows through every item, mounted or not, and useCommandWindow
// scrolls the highlighted one into view.
//
// Results a server found (Search's message matches) join the same list:
// fuzzyThen ranks the rest by Command's fuzzy filter and keeps those after
// every match, in the server's order; useAsyncOptions loads them as typing
// pauses; a two-line row (CommandItemLines) shows each with its matching
// line, and CommandStatus says, quietly, when they failed to load. Since
// the filter is then a function, CommandMatchText marks a label's matched
// letters itself, as CommandItemText does for the built-in filters.
//
// A result can have a … beside it (CommandRow, CommandRowAction), its menu
// rendered outside the list, and a field can stand in for the search
// field (CommandFieldEdit), since the listbox may hold only options. From
// md, CommandPreview shows the highlighted result beside the list.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type * as React from "react"
import { useAsyncOptions } from "@ui-sdk/react/async-options"
import {
  Command,
  CommandEmpty as CommandEmptyPrimitive,
  CommandGroup as CommandGroupPrimitive,
  CommandGroupLabel as CommandGroupLabelPrimitive,
  CommandInput as CommandInputPrimitive,
  CommandItem as CommandItemPrimitive,
  CommandItemText as CommandItemTextPrimitive,
  CommandList as CommandListPrimitive,
  CommandStatus as CommandStatusPrimitive,
  type CommandData,
  type CommandDataItem,
  type MatchSegment,
  type SearchFilter,
} from "@ui-sdk/react/command"
import {
  fuzzyScore,
  matchRanges,
  matchSegments,
} from "@ui-sdk/react/text-match"

import { MenuTrigger } from "@/components/ui/menu"
import { cn } from "@/lib/utils"

/** The search field, Grok's: no glyph, its text 16px in, and `hint` at
 *  its end (like "Next section Tab"). `hidden`: kept in the page, out of
 *  sight, while CommandFieldEdit stands in for it. */
function CommandInput({
  className,
  hidden = false,
  caretHidden = false,
  hint,
  ...props
}: React.ComponentProps<typeof CommandInputPrimitive> & {
  hidden?: boolean
  /** No caret yet: while a sheet slides in, iOS draws it where the field
   *  was, so it jumps; show it once the sheet has settled. */
  caretHidden?: boolean
  hint?: ReactNode
}) {
  return (
    <div
      hidden={hidden}
      className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4"
    >
      <CommandInputPrimitive
        className={cn(
          "min-w-0 flex-1 bg-transparent field-text text-foreground outline-hidden placeholder:text-muted-foreground",
          caretHidden && "caret-transparent",
          className
        )}
        {...props}
      />
      {hint !== undefined && (
        <span
          aria-hidden
          className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground select-none pointer-coarse:hidden"
        >
          {hint}
        </span>
      )}
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
        "flex h-10 shrink-0 items-center gap-2.5 rounded-item px-3 text-base text-ink-secondary outline-hidden select-none has-data-[slot=command-item-lines]:h-auto highlighted:bg-accent highlighted:text-foreground [&>span]:min-w-0 [&>span]:flex-1 [&>span]:truncate [&>svg]:size-4.5 [&>svg]:shrink-0",
        className
      )}
      {...props}
    />
  )
}

/** What sits at a row's end, after its label: a relative time in muted
 *  14px, or keycaps. */
function CommandItemEnd({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-item-end"
      className={cn(
        "ms-3 flex-none! text-sm text-muted-foreground tabular-nums",
        className
      )}
      {...props}
    />
  )
}

/** Text in pieces, the matched ones in medium full ink. */
function Segments({ segments }: { segments: readonly MatchSegment[] }) {
  return segments.map((segment, index) =>
    segment.match ? (
      <strong key={index} className="font-medium text-foreground">
        {segment.text}
      </strong>
    ) : (
      segment.text
    )
  )
}

/** The command's label, the letters the search matched in medium full
 *  ink. */
function CommandItemText() {
  return (
    <CommandItemTextPrimitive dir="auto">
      {(text) => <Segments segments={text.segments} />}
    </CommandItemTextPrimitive>
  )
}

/** `text` with the letters `query` matches marked, the way the fuzzy
 *  filter matches them: CommandItemText's look, under fuzzyThen. */
function CommandMatchText({ text, query }: { text: string; query: string }) {
  const segments = useMemo(
    () => matchSegments(text, matchRanges(text, query, "fuzzy")),
    [text, query]
  )
  return (
    <span dir="auto">
      <Segments segments={segments} />
    </span>
  )
}

/** A two-line row's content: `label`, and under it `line` in pieces, in
 *  smaller muted ink with its matches in full ink. */
function CommandItemLines({
  label,
  line,
}: {
  label: string
  line: readonly MatchSegment[]
}) {
  return (
    <span data-slot="command-item-lines" className="flex flex-col py-2">
      <span dir="auto" className="truncate">
        {label}
      </span>
      <span dir="auto" className="truncate text-sm text-muted-foreground">
        <Segments segments={line} />
      </span>
    </span>
  )
}

/** Command's fuzzy filter by label, except for the items in `kept`,
 *  results a server already matched: those stay whatever was typed,
 *  after every fuzzy match, in `kept`'s order. The items in `first`
 *  (Search's actions) rank above every other match while they match. */
function fuzzyThen(
  kept: readonly string[],
  first: ReadonlySet<string> = new Set()
): SearchFilter<string> {
  const at = new Map(kept.map((value, index) => [value, index]))
  return (item, query) => {
    const index = at.get(item.value)
    if (index !== undefined) return KEPT * (1 - index / (kept.length + 1))
    const score = fuzzyScore(item.label, query)
    // fuzzyScore is at most 1.
    return first.has(item.value) && score > 0 ? 1 + score : score
  }
}

/** A kept item's score: above zero, so it shows, and below any fuzzy
 *  match's, so it comes after them. */
const KEPT = 1e-6

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
    // A mounted row (in view, or past the window, like a server's
    // results) scrolls itself in; one the window hasn't rendered is
    // placed by its index.
    const row = element.querySelector(`[aria-posinset="${index + 1}"]`)
    if (row !== null) return row.scrollIntoView({ block: "nearest" })
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

/** A result with actions beside it: the option, then its
 *  CommandRowAction, in the same box, so the listbox's own entries are
 *  options only. The option leaves room at its end for the …. */
function CommandRow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-row"
      className={cn("group/row relative [&>[role=option]]:pe-10", className)}
      {...props}
    />
  )
}

/** A row's 24px …, its menu's trigger, 8px from its end and centered on
 *  its first line: shown while the row is hovered or highlighted, or its
 *  menu is open, and always on touch screens, with a 40px touch area
 *  there. For the pointer only: no tab stop (the field keeps the
 *  keyboard) and hidden from assistive tech, so the listbox holds only
 *  options; the open chat's own …, and the sidebar row's, hold the same
 *  actions for everyone. */
function CommandRowAction({
  className,
  ...props
}: React.ComponentProps<typeof MenuTrigger>) {
  return (
    <MenuTrigger
      data-slot="command-row-action"
      tabIndex={-1}
      aria-hidden
      className={cn(
        "absolute end-2 top-2 flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-hidden select-none group-hover/row:opacity-100 group-has-data-highlighted/row:opacity-100 after:absolute after:-inset-2 hover:bg-accent hover:text-foreground data-open:bg-accent data-open:text-foreground data-open:opacity-100 pointer-coarse:opacity-100 pointer-fine:after:hidden [&>svg]:size-3.5 [&>svg]:shrink-0",
        className
      )}
      {...props}
    />
  )
}

/** In the search field's row, in its place (CommandInput `hidden`):
 *  `icon` at its start, then another field, like Search's
 *  rename, with its ✕ ✓. */
function CommandFieldEdit({
  icon,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { icon: ReactNode }) {
  return (
    <div
      data-slot="command-field-edit"
      className={cn(
        "flex h-14 shrink-0 items-center gap-3 border-b border-border ps-4 pe-2 [&>svg]:size-icon [&>svg]:shrink-0 [&>svg]:text-muted-foreground",
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </div>
  )
}

/** Beside the list from md, the highlighted result's preview, scrolling
 *  on its own; none on a phone. */
function CommandPreview({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="region"
      data-slot="command-preview"
      className={cn(
        "hidden min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain border-s border-border p-5 md:flex",
        className
      )}
      {...props}
    />
  )
}

/** A quiet line under the list, from `children` (the list's state), or
 *  nothing. */
function CommandStatus({
  className,
  ...props
}: React.ComponentProps<typeof CommandStatusPrimitive>) {
  return (
    <CommandStatusPrimitive
      className={cn(
        "shrink-0 px-4 py-2 text-sm text-muted-foreground empty:hidden",
        className
      )}
      {...props}
    />
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

export { createCommandController } from "@ui-sdk/react/command"
export {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandItemEnd,
  CommandItemText,
  CommandItemLines,
  CommandList,
  CommandMatchText,
  CommandPreview,
  CommandRow,
  CommandRowAction,
  CommandFieldEdit,
  CommandStatus,
  CommandWindow,
  fuzzyScore,
  fuzzyThen,
  useAsyncOptions,
  useCommandWindow,
  type CommandData,
  type CommandDataItem,
  type MatchSegment,
}
