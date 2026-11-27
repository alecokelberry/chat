// The icon row under a reply: Copy puts the reply's markdown on the
// clipboard (a reply stopped while thinking has no words, so no Copy), and
// Retry, on the last reply only, asks the same model again and replaces
// it. Then who answered and how long it took ("Super · 4.2s"). Under the
// last reply the row always shows; under earlier ones on hover or focus
// (always on touch).
import { RefreshCwIcon } from "lucide-react"

import { CopyAction, MessageAction } from "@/components/chat/message-action"
import { MessageToolbar } from "@/components/ui/message-toolbar"

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
  return (
    <MessageToolbar
      aria-label="Reply actions"
      reveal={latest ? "always" : "hover"}
    >
      {text !== "" && <CopyAction text={text} label="Copy reply" />}
      {onRetry && (
        <MessageAction
          label="Retry"
          onClick={onRetry}
          confirm="Replaces this reply with a new one from the model"
        >
          <RefreshCwIcon aria-hidden />
        </MessageAction>
      )}
      {answeredBy !== undefined && (
        <span className="ms-1.5 text-xs text-muted-foreground tabular-nums">
          {answeredBy}
        </span>
      )}
    </MessageToolbar>
  )
}
