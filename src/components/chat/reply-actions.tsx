// The icon row under a reply: Copy puts the reply's markdown on the
// clipboard (the icon swaps to a check and its name to "Copied" for a
// moment), and Retry, on the last reply only, asks the same model again and
// replaces it. Then who answered and how long it took ("Super · 4.2s").
// Under the last reply the row always shows; under earlier ones on hover
// or focus (always on touch).
import { useEffect, useState, type ReactNode } from "react"
import { CheckIcon, CopyIcon, RefreshCwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  MessageToolbar,
  MessageToolbarButton,
} from "@/components/ui/message-toolbar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export function ReplyActions({
  text,
  latest,
  answeredBy,
  onRetry,
}: {
  /** The reply's markdown. */
  text: string
  latest: boolean
  /** Who answered and how long it took, once known. */
  answeredBy?: string
  /** Shown only when given: the last reply, with nothing streaming. */
  onRetry?: () => void
}) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])

  return (
    <MessageToolbar
      aria-label="Reply actions"
      reveal={latest ? "always" : "hover"}
    >
      <ReplyAction
        label={copied ? "Copied" : "Copy"}
        // Where the browser refuses (a denied permission), nothing changes:
        // the name stays Copy.
        onClick={() => {
          navigator.clipboard.writeText(text).then(
            () => setCopied(true),
            () => undefined
          )
        }}
      >
        <span className="grid *:col-start-1 *:row-start-1 *:transition-swap motion-reduce:*:transition-none">
          <CopyIcon
            aria-hidden
            className={cn(copied && "scale-50 opacity-0")}
          />
          <CheckIcon
            aria-hidden
            className={cn(!copied && "scale-50 opacity-0")}
          />
        </span>
      </ReplyAction>
      {onRetry && (
        <ReplyAction
          label="Retry"
          onClick={onRetry}
          confirm="Replaces this reply with a new one from the model"
        >
          <RefreshCwIcon aria-hidden />
        </ReplyAction>
      )}
      {answeredBy !== undefined && (
        <span className="ms-1.5 text-xs text-muted-foreground tabular-nums">
          {answeredBy}
        </span>
      )}
    </MessageToolbar>
  )
}

/** One icon button in the row, named by its tooltip (type="label"), so a
 *  screen reader hears the name once. */
function ReplyAction({
  label,
  onClick,
  confirm,
  children,
}: {
  label: string
  onClick: () => void
  /** What it does, for an agent to ask a person first. */
  confirm?: string
  children: ReactNode
}) {
  return (
    <Tooltip type="label">
      <TooltipTrigger
        render={
          <MessageToolbarButton
            onClick={onClick}
            data-agent-confirm={confirm}
            render={<Button variant="ghost" size="action" />}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}
