// The composer: where a message is written and sent. Enter sends and
// Shift+Enter starts a new line (ui-sdk's submit shortcut); an empty
// message doesn't send. While a reply streams, Send becomes Stop. The
// model picker beside Send chooses who answers the message (the chat holds
// the choice, so an edited question is answered by it too).
//
// Grok's one-row pill (the archived Chat's): 58px tall for one line, 12px
// in, 29px corners, the text 20px from the start, then the model and a
// 32px Send at the end; longer text grows the row and they stay on its
// last line. A tap doesn't change it (the caret shows where you are): only
// keyboard focus rings it (the keyboard variant, focus-modality.tsx).
// Send and Stop are icons alone, named by their tooltips (type "label").
import { useState } from "react"
import { ArrowUpIcon, SquareIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ModelPicker } from "@/components/chat/model-picker"
import type { ModelKey } from "@/lib/ai/models"

export function Composer({
  busy = false,
  model,
  onModelChange,
  onSend,
  onStop,
}: {
  busy?: boolean
  model: ModelKey
  onModelChange: (model: ModelKey) => void
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
      <ModelPicker value={model} onValueChange={onModelChange} />
      {busy ? (
        <Tooltip type="label">
          <TooltipTrigger
            render={<Button variant="stop" size="circle" onClick={onStop} />}
          >
            <SquareIcon fill="currentColor" />
          </TooltipTrigger>
          <TooltipContent>Stop</TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip type="label">
          <TooltipTrigger
            render={
              <Button
                type="submit"
                variant="send"
                size="circle"
                disabled={message === ""}
                // Still focusable, so its tooltip reaches keyboards too
                // (ui-sdk's Tooltip docs, Disabled buttons).
                focusableWhenDisabled
                data-agent-confirm="Sends this message to the model"
              />
            }
          >
            <ArrowUpIcon />
          </TooltipTrigger>
          <TooltipContent>Send</TooltipContent>
        </Tooltip>
      )}
    </form>
  )
}
