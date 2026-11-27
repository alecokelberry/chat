// Usage's look (Settings › Usage, src/components/chat/settings.tsx): the
// total as one large figure, a tall segmented bar that splits it into its
// parts, and a legend under it that names each part with its numbers, so
// it is also the table view. The bar follows the dataviz skill's tall
// segmented bar: 28px, each part its own block with 4px corners and a 2px
// gap of the card's surface between, its width the part's share, its
// share printed inside at the start when the block is wide enough, in the
// near-black that reads on every fill. A narrower block prints nothing;
// its legend row carries the share beside its name instead, so no number
// is shown twice and none is lost. Colors are the chart tokens in
// src/styles/app.css, by the part's fixed slot, never by its rank. The
// bar is one image to screen readers, named with every part; the legend
// repeats it as text. No hover layer: every number is already in the
// legend right under the bar, and a phone has no hover.
import type * as React from "react"

import { cn } from "@/lib/utils"

declare module "react" {
  interface CSSProperties {
    /** A UsageBar block's amount, which its width grows by. */
    "--share"?: number
  }
}

/** The fill for each slot. Whole class names, so Tailwind finds them. */
const FILLS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
] as const

const fillOf = (slot: number) => FILLS[(slot - 1) % FILLS.length]

/** The smallest share a block prints inside itself: about 34px on a
 *  phone's card, the room "12%" needs with its padding. */
export const SHARE_INSIDE_MIN = 12

/** The card's top: the total over the bar. */
function UsageSummary({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="usage-summary"
      className={cn("flex flex-col gap-4 p-4", className)}
      {...props}
    />
  )
}

/** The total, large, with its unit after it and a muted line under. */
function UsageTotal({
  value,
  unit,
  detail,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  value: React.ReactNode
  unit: React.ReactNode
  detail?: React.ReactNode
}) {
  return (
    <div
      data-slot="usage-total"
      className={cn("flex flex-col gap-0.5", className)}
      {...props}
    >
      <p className="flex items-baseline gap-1.5">
        <span className="text-3xl font-medium text-foreground">{value}</span>
        <span className="text-base text-muted-foreground">{unit}</span>
      </p>
      {detail !== undefined && (
        <p className="text-sm text-muted-foreground">{detail}</p>
      )}
    </div>
  )
}

type UsageBarPart = {
  key: string
  slot: number
  /** What its width is in proportion to. */
  amount: number
  /** What it prints inside, when it's at least SHARE_INSIDE_MIN. */
  percent: number
}

/** The split. With no parts it draws an empty track. */
function UsageBar({
  parts,
  className,
  ...props
}: React.ComponentProps<"div"> & { parts: readonly UsageBarPart[] }) {
  return (
    <div
      data-slot="usage-bar"
      role="img"
      className={cn("flex h-7 w-full gap-0.5", className)}
      {...props}
    >
      {parts.length === 0 ? (
        <div className="flex-1 rounded-sm bg-secondary" />
      ) : (
        parts.map((part) => (
          <div
            key={part.key}
            data-part={part.key}
            className={cn(
              "flex min-w-1 grow-(--share) basis-0 items-center rounded-sm ps-2 text-xs font-medium text-chart-ink tabular-nums",
              fillOf(part.slot)
            )}
            style={{ "--share": part.amount }}
          >
            {part.percent >= SHARE_INSIDE_MIN && `${part.percent}%`}
          </div>
        ))
      )}
    </div>
  )
}

/** The legend's rows, in the bar's order. */
function UsageLegend({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="usage-legend"
      className={cn("flex flex-col", className)}
      {...props}
    />
  )
}

/** One part: its color's dot, its name (and its share, when its block
 *  is too narrow to print it) over a muted `detail`, and its `value` at
 *  the end. */
function UsageLegendItem({
  series,
  name,
  share,
  detail,
  value,
  className,
  ...props
}: Omit<React.ComponentProps<"li">, "children"> & {
  /** Its color's slot, 1 to 5. */
  series: number
  name: React.ReactNode
  /** Shown beside the name; leave out when the bar prints it. */
  share?: React.ReactNode
  detail?: React.ReactNode
  value: React.ReactNode
}) {
  return (
    <li
      data-slot="usage-legend-item"
      className={cn(
        "flex min-h-16 items-center gap-3 border-t border-border px-4 py-3",
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn("size-2.5 shrink-0 rounded-full", fillOf(series))}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base text-foreground">
          {name}
          {share !== undefined && (
            <span className="text-muted-foreground"> · {share}</span>
          )}
        </span>
        {detail !== undefined && (
          <span className="truncate text-sm text-muted-foreground">
            {detail}
          </span>
        )}
      </div>
      <span className="shrink-0 text-sm text-foreground tabular-nums">
        {value}
      </span>
    </li>
  )
}

export { UsageSummary, UsageTotal, UsageBar, UsageLegend, UsageLegendItem }
