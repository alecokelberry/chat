// The composer: where a message is written and sent. Enter sends and
// Shift+Enter starts a new line (ui-sdk's submit shortcut); an empty
// message doesn't send. While a reply streams, Send becomes Stop. The
// model picker beside Send chooses who answers the message; it starts on
// `defaultModel` (the chat's last model) and keeps your choice after.
//
// Grok's one-row pill (the archived Chat's): 58px tall for one line, 12px
// in, 29px corners, the text 20px from the start, then the model and a
// 32px Send at the end; longer text grows the row and they stay on its
// last line. A tap doesn't change it (the caret shows where you are): only
// keyboard focus rings it (the keyboard variant, focus-modality.tsx).
import { useState } from "react"
import { ArrowUpIcon, SquareIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ModelPicker } from "@/components/chat/model-picker"
import { DEFAULT_MODEL, type ModelKey } from "@/lib/ai/models"

export function Composer({
  busy = false,
  defaultModel = DEFAULT_MODEL,
  onSend,
  onStop,
}: {
  busy?: boolean
  defaultModel?: ModelKey
  onSend: (text: string, model: ModelKey) => void
  onStop?: () => Promise<void> | void
}) {
  const [text, setText] = useState("")
  const [model, setModel] = useState(defaultModel)
  const message = text.trim()

  function send() {
    if (message === "" || busy) return
    onSend(message, model)
    setText("")
  }

  return (
    <form
      className="flex items-end gap-1 rounded-composer border border-border-strong bg-surface p-3 focus-within:border-input keyboard:focus-within:ring-2 keyboard:focus-within:ring-ring"
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
      <ModelPicker value={model} onValueChange={setModel} />
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
