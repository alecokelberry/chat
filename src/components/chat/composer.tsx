// The composer: where a message is written and sent. Enter sends and
// Shift+Enter starts a new line (ui-sdk's submit shortcut); an empty
// message doesn't send. While a reply streams, Send becomes Stop.
import { useState } from "react"
import { ArrowUpIcon, SquareIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export function Composer({
  busy = false,
  onSend,
  onStop,
}: {
  busy?: boolean
  onSend: (text: string) => void
  onStop?: () => Promise<void> | void
}) {
  const [text, setText] = useState("")
  const message = text.trim()

  function send() {
    if (message === "" || busy) return
    onSend(message)
    setText("")
  }

  return (
    <form
      className="flex items-end gap-2 rounded-3xl border border-border-strong bg-surface p-2.25 ps-5 transition-shadow duration-pane focus-within:ring-2 focus-within:ring-ring"
      onSubmit={(event) => {
        event.preventDefault()
        send()
      }}
    >
      <Textarea
        aria-label="Message"
        placeholder="Ask anything…"
        rows={1}
        autoResize
        submitShortcut="enter"
        value={text}
        onValueChange={setText}
      />
      {busy ? (
        <Button variant="stop" size="circle" aria-label="Stop" onClick={onStop}>
          <SquareIcon fill="currentColor" />
        </Button>
      ) : (
        <Button
          type="submit"
          variant="send"
          size="circle"
          aria-label="Send"
          disabled={message === ""}
          data-agent-confirm="Sends this message to the model"
        >
          <ArrowUpIcon />
        </Button>
      )}
    </form>
  )
}
