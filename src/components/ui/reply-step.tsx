// Reply step: one thing the model did on its way to a reply (thinking; web
// search next), as a quiet line above it that opens on press to show the
// detail. ui-sdk's Collapsible, closed at first. While the step runs, the
// spinner stands in for its icon, its label shimmers and the seconds so far
// follow it; done, it shows its final label ("Thought for 12s"). A status
// tells screen readers when a step that ran here ends (the waiting marker
// already said it started; nothing for a saved one). The closed panel stays
// in the page hidden until found, so the browser's Find reaches it, and it
// opens and closes by its measured height.
import { useEffect, useState, type ReactNode } from "react"
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@ui-sdk/react/collapsible"
import { ChevronRightIcon } from "lucide-react"

import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

function ReplyStep({
  icon,
  label,
  running,
  children,
}: {
  icon: ReactNode
  /** What it's doing ("Thinking…") while it runs, then what it did. */
  label: string
  running: boolean
  children: ReactNode
}) {
  const [ranHere, setRanHere] = useState(running)
  if (running && !ranHere) setRanHere(true)
  return (
    <Collapsible data-slot="reply-step" className="flex min-w-0 flex-col">
      <span role="status" className="sr-only">
        {ranHere && !running && label}
      </span>
      <CollapsibleTrigger className="group/reply-step relative flex min-h-6 w-fit max-w-full min-w-0 press items-center gap-2 rounded-lg text-start text-sm text-muted-foreground outline-hidden select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:text-foreground pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-2">
        <span
          aria-hidden
          className="flex size-4 shrink-0 items-center justify-center [&_svg:not([class*='size-'])]:size-4"
        >
          {running ? <Spinner /> : icon}
        </span>
        <span className={cn("min-w-0 truncate", running && "shimmer")}>
          {label}
        </span>
        {running && <Seconds />}
        <ChevronRightIcon
          aria-hidden
          className="-ms-1 size-4 shrink-0 transition-transform duration-fast ease-standard group-data-open/reply-step:rotate-90"
        />
      </CollapsibleTrigger>
      <CollapsiblePanel
        hiddenUntilFound
        className="h-(--collapsible-panel-height) overflow-hidden transition-collapse data-ending-style:h-0 data-starting-style:h-0"
      >
        <div className="ms-1.75 mt-2 mb-1 min-w-0 border-s ps-4 text-sm wrap-break-word whitespace-pre-wrap text-muted-foreground">
          {children}
        </div>
      </CollapsiblePanel>
    </Collapsible>
  )
}

/** The whole seconds since the step started running, from 1s on. */
function Seconds() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const id = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - start) / 1000)),
      1000
    )
    return () => window.clearInterval(id)
  }, [])
  if (seconds === 0) return null
  return (
    <span aria-hidden className="shrink-0 tabular-nums">
      {seconds}s
    </span>
  )
}

export { ReplyStep }
