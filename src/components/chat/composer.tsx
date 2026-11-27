// The composer: where a message is written and sent. Enter sends and
// Shift+Enter starts a new line (ui-sdk's submit shortcut); an empty
// message doesn't send. While a reply streams, Send becomes Stop. The
// model picker beside Send chooses who answers the message (the chat holds
// the choice, so an edited question is answered by it too).
//
// Grok's one-row pill (the archived Chat's): 58px tall for one line, 12px
// in, 29px corners, the + (attachments.tsx) at the start, then the text,
// the model and a 32px Send at the end. Once the text wraps, it takes the
// pill's whole width on a row of its own, with the +, the model and Send on
// a row below, as Grok and ChatGPT do, so it isn't squeezed between them;
// it stays there until the text is cleared, so it doesn't jump back and
// forth as it fits and stops fitting. Flex order moves the text without
// moving it in the page, so the caret stays put. Attached files sit as
// tiles above the text, inside the pill; a question can be only files.
// Send waits until each is ready, and while the model can't see them
// (attachments.tsx). A tap doesn't ring the pill (the caret shows where
// you are): only keyboard focus does (the keyboard variant,
// focus-modality.tsx).
// Send and Stop are icons alone, named by their tooltips (type "label").
// `focusOnMount` puts the caret in it as it mounts: a new chat's first send
// moves to its own page, and focus goes on into that page's composer.
import { useEffect, useRef, useState, type RefObject } from "react"
import { ArrowUpIcon, SquareIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  AttachMenu,
  CantSeeImages,
  AttachmentsInput,
  AttachmentTiles,
  useAttachments,
} from "@/components/chat/attachments"
import { ModelPicker } from "@/components/chat/model-picker"
import { cn } from "@/lib/utils"
import { DEFAULT_MODEL, modelOf, type ModelKey } from "@/lib/ai/models"
import type { AttachmentPart } from "@/lib/chat/attachments"

export function Composer({
  focusOnMount = false,
  busy = false,
  model,
  onModelChange,
  onSend,
  onStop,
}: {
  focusOnMount?: boolean
  busy?: boolean
  model: ModelKey
  onModelChange: (model: ModelKey) => void
  onSend: (text: string, files: AttachmentPart[]) => void
  onStop?: () => Promise<void> | void
}) {
  const [text, setText] = useState("")
  const message = text.trim()
  const field = useRef<HTMLTextAreaElement>(null)
  // Read once: it's about the moment this composer appears.
  const focusAtMount = useRef(focusOnMount)
  useEffect(() => {
    if (focusAtMount.current) field.current?.focus()
  }, [])

  const wrapped = useWrapped(field, text)

  const attachments = useAttachments()
  const empty = message === "" && attachments.files.length === 0
  const chosen = modelOf(model)
  const blind = attachments.hasImages && !chosen.seesImages
  const ready = !empty && !attachments.preparing && !blind

  function send() {
    if (!ready || busy) return
    onSend(message, attachments.parts)
    setText("")
    attachments.clear()
  }

  return (
    <AttachmentsInput attachments={attachments} pasteInto={() => field.current}>
      <form
        className="flex flex-col rounded-composer border border-border-strong bg-surface p-3 focus-within:border-input keyboard:focus-within:ring-2 keyboard:focus-within:ring-ring"
        onSubmit={(event) => {
          event.preventDefault()
          send()
        }}
      >
        <AttachmentTiles attachments={attachments} />
        <div
          className={cn(
            "flex items-end gap-x-1",
            wrapped && "flex-wrap gap-y-2"
          )}
        >
          <AttachMenu controller={attachments.controller} />
          <Textarea
            className={cn(
              "min-w-0 flex-1",
              wrapped && "order-first basis-full"
            )}
            ref={field}
            aria-label="Message"
            placeholder="Ask anything…"
            rows={1}
            autoResize
            submitShortcut="enter"
            value={text}
            onValueChange={setText}
          />
          <div className={cn("flex", wrapped && "ms-auto")}>
            <ModelPicker value={model} onValueChange={onModelChange} />
          </div>
          <SendOrStop busy={busy} ready={ready} onStop={onStop} />
        </div>
      </form>
      <CantSeeImages
        blind={blind}
        model={chosen.name}
        to={modelOf(DEFAULT_MODEL).name}
        onSwitch={() => onModelChange(DEFAULT_MODEL)}
      />
    </AttachmentsInput>
  )
}

/** Send, or Stop while a reply streams: icons alone, named by tooltips. */
function SendOrStop({
  busy,
  ready,
  onStop,
}: {
  busy: boolean
  ready: boolean
  onStop?: () => Promise<void> | void
}) {
  return busy ? (
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
            disabled={!ready}
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
  )
}

/** Whether the text has wrapped, so it moves to a row of its own, until
 * the text is cleared. A line is 32px tall and two are 56px (Textarea), so
 * a field over 40px has wrapped. */
function useWrapped(
  field: RefObject<HTMLTextAreaElement | null>,
  text: string
) {
  const [wrapped, setWrapped] = useState(false)
  // Reset while rendering, as React's "adjusting state when a prop changes".
  if (wrapped && text === "") setWrapped(false)
  useEffect(() => {
    const el = field.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      if (el.offsetHeight > 40) setWrapped(true)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [field])
  return wrapped
}
