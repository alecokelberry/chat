// File input: ui-sdk's file input (the system picker, paste, drops, the
// accept and size checks, a list with one Tab stop where Delete removes
// the focused file, and announcements) with the composer's look. Its list
// is a row of 56px tiles with 12px corners, 8px apart (a document's is a
// wider FileChip), that scrolls sideways, fading at its ends, when it runs
// out of room (its width never widens the composer); a tile's ✕ is a 20px
// circle on its top corner (a 40px touch area on touch screens), in the
// popover fill.
// The page-wide drop zone is a dimmed overlay that shows only while files
// are dragged over the window, saying what a drop does.
import type * as React from "react"
import {
  createFileInputController,
  FileInput,
  FileInputDropzone as FileInputDropzonePrimitive,
  FileInputItem as FileInputItemPrimitive,
  FileInputItemRemove as FileInputItemRemovePrimitive,
  FileInputList as FileInputListPrimitive,
} from "@ui-sdk/react/file-input"

import { cn } from "@/lib/utils"

/** Takes files dropped anywhere on the page, shown as an overlay while
 *  they're dragged over it. */
function FileInputDropOverlay({
  className,
  ...props
}: Omit<React.ComponentProps<typeof FileInputDropzonePrimitive>, "target">) {
  return (
    <FileInputDropzonePrimitive
      target="document"
      className={cn(
        "pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-overlay text-base font-medium text-foreground opacity-0 transition-opacity duration-fast ease-standard data-dragging:pointer-events-auto data-dragging:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function FileInputList({
  className,
  ...props
}: React.ComponentProps<typeof FileInputListPrimitive>) {
  return (
    <FileInputListPrimitive
      className={cn(
        "flex scroll-fade-x scrollbar-none gap-2 overflow-x-auto overscroll-x-contain px-1 pt-2 pb-1 outline-hidden contain-inline-size",
        className
      )}
      {...props}
    />
  )
}

function FileInputItem({
  className,
  ...props
}: React.ComponentProps<typeof FileInputItemPrimitive>) {
  return (
    <FileInputItemPrimitive
      className={cn(
        "relative flex h-14 min-w-14 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground outline-hidden no-touch-callout focus-visible:ring-2 focus-visible:ring-ring has-data-[slot=file-chip]:border-0 [&>img]:aspect-square [&>img]:h-full [&>img]:rounded-xl [&>img]:object-cover",
        className
      )}
      {...props}
    />
  )
}

function FileInputItemRemove({
  className,
  ...props
}: React.ComponentProps<typeof FileInputItemRemovePrimitive>) {
  return (
    <FileInputItemRemovePrimitive
      className={cn(
        "absolute -end-1.5 -top-1.5 flex size-5 press items-center justify-center rounded-full border border-border-strong bg-popover text-foreground after:absolute after:-inset-2 hover:bg-secondary-hover pointer-coarse:after:-inset-2.5 [&_svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

export {
  createFileInputController,
  FileInput,
  FileInputDropOverlay,
  FileInputItem,
  FileInputItemRemove,
  FileInputList,
}
