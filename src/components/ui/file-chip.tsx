// File chip: a document's tile (a PDF or text file attached to a question,
// chat/attachments.tsx), in the composer and in the thread: a 56px-tall
// tile, 176px wide, with 12px corners, a file icon in a 32px square, then
// the file's name over its kind ("PDF", "Text") in muted 12px. A long name
// gives way in the middle, keeping its last 8 characters (the extension,
// and the "-v12" that tells two files apart); the whole name is its title.
import type * as React from "react"
import { FileTextIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const TAIL = 8

function FileChip({
  name,
  kind,
  className,
  ...props
}: React.ComponentProps<"div"> & { name: string; kind: string }) {
  const long = name.length > TAIL * 2
  return (
    <div
      data-slot="file-chip"
      title={name}
      className={cn(
        "flex h-14 w-44 shrink-0 items-center gap-2.5 rounded-xl border border-border bg-secondary px-2.5 text-start",
        className
      )}
      {...props}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground [&_svg]:size-4">
        <FileTextIcon aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="flex min-w-0 text-sm font-medium text-foreground">
          {long ? (
            <>
              <span className="truncate">{name.slice(0, -TAIL)}</span>
              <span className="shrink-0">{name.slice(-TAIL)}</span>
            </>
          ) : (
            <span className="truncate">{name}</span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">{kind}</span>
      </span>
    </div>
  )
}

export { FileChip }
