// The composer: where a message is written and sent. With a mouse and
// keyboard, Enter sends and Shift+Enter starts a new line (ui-sdk's submit
// shortcut). On a touch screen Return starts a new line and Send sends, as
// in iMessage and ChatGPT, since the iPhone keyboard has no Shift+Return
// (useCoarsePointer, from the pointer media feature). An empty message
// doesn't send. While a reply streams, Send becomes Stop. The
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
// `onDraft` tells the new chat page whether there's anything to send, so it
// can put away the starters the composer would grow over.
// `fill` (the ref's handle) puts words in it and focuses it: a starter.
// `focusOnMount` puts the caret in it as it mounts: a new chat's first send
// moves to its own page, and focus goes on into that page's composer.
// Typing `/` at the start of the text lists the models (ui-sdk's
// TriggerMenu, connected to the textarea through textFieldAdapter so
// Enter-to-send and auto-resize stay as they were): picking one switches
// the model and takes the `/` and what was typed after it out of the text,
// keeping the rest. Enter picks while the list is open and never sends.
// A private chat's composer (`isPrivate`) has a dashed border, as Grok's
// does, so it's plain the chat isn't being saved.
// Offline, Send waits and a line above the pill says so ("Offline.
// Reconnecting…"): the draft stays, nothing is sent into the void, and the
// line goes as the browser comes back online (`useOnline`).
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
  type RefObject,
} from "react"
import { ArrowUpIcon, CheckIcon, SquareIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useCoarsePointer } from "@/components/ui/preferences"
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
import {
  TriggerMenu,
  TriggerMenuContent,
  TriggerMenuEmpty,
  TriggerMenuItem,
  TriggerMenuList,
  TriggerMenuStatus,
  textFieldAdapter,
  type TextEditorAdapter,
} from "@/components/ui/trigger-menu"
import { cn } from "@/lib/utils"
import { DEFAULT_MODEL, MODELS, modelOf, type ModelKey } from "@/lib/ai/models"
import type { AttachmentPart } from "@/lib/chat/attachments"

/** Enter sends with a mouse and keyboard; on a touch screen nothing does,
 *  so Return starts a new line and Send sends. */
function useSubmitShortcut() {
  return useCoarsePointer() ? undefined : "enter"
}

/** What a parent can do to the composer: put words in it (a starter). */
export type ComposerHandle = { fill: (text: string) => void }

export function Composer({
  ref,
  onDraft,
  isPrivate,
  focusOnMount = false,
  busy = false,
  model,
  onModelChange,
  onSend,
  onStop,
}: {
  ref?: Ref<ComposerHandle>
  /** Told when the composer gains or loses anything to send. */
  onDraft?: (started: boolean) => void
  isPrivate?: boolean
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
  // The `/` menu's link to the textarea, made once the textarea is in the page.
  const [editor, setEditor] = useState<TextEditorAdapter>()
  const [pill, setPill] = useState<HTMLFormElement | null>(null)
  const fieldRef = useCallback((el: HTMLTextAreaElement | null) => {
    field.current = el
    if (el)
      setEditor((current) =>
        current?.element === el ? current : textFieldAdapter(el)
      )
  }, [])
  const submitShortcut = useSubmitShortcut()
  // Read once: it's about the moment this composer appears.
  const focusAtMount = useRef(focusOnMount)
  useEffect(() => {
    if (focusAtMount.current) field.current?.focus()
  }, [])

  useImperativeHandle(ref, () => ({
    fill(next) {
      setText(next)
      field.current?.focus()
    },
  }))

  const wrapped = useWrapped(field, text)

  const attachments = useAttachments()
  const empty = message === "" && attachments.files.length === 0
  const chosen = modelOf(model)
  const blind = attachments.hasImages && !chosen.seesImages
  useEffect(() => onDraft?.(!empty), [onDraft, empty])
  const online = useOnline()
  const ready = !empty && !attachments.waiting && !blind

  function send() {
    if (!ready || busy || !online) return
    onSend(message, attachments.parts)
    setText("")
    attachments.clear()
  }

  return (
    <AttachmentsInput attachments={attachments} pasteInto={() => field.current}>
      <TriggerMenu<ModelKey>
        editor={editor}
        triggers={[
          {
            char: "/",
            boundary: "start",
            type: "model",
            insert: () => "",
          },
        ]}
        onSelect={onModelChange}
      >
        <form
          ref={setPill}
          data-private={isPrivate}
          className="relative flex flex-col rounded-composer border border-border-strong bg-surface p-3 focus-within:border-input data-[private=true]:border-dashed keyboard:focus-within:ring-2 keyboard:focus-within:ring-ring"
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
              ref={fieldRef}
              aria-label="Message"
              placeholder="Ask anything…"
              rows={1}
              autoResize
              submitShortcut={submitShortcut}
              value={text}
              onValueChange={setText}
            />
            <div className={cn("flex", wrapped && "ms-auto")}>
              <ModelPicker value={model} onValueChange={onModelChange} />
            </div>
            <SendOrStop
              busy={busy}
              ready={ready}
              online={online}
              onStop={onStop}
            />
          </div>
          <OfflineLine offline={!online} />
        </form>
        <div className="sr-only">
          <TriggerMenuStatus />
        </div>
        <TriggerMenuContent anchor={pill}>
          <TriggerMenuEmpty>No model matches</TriggerMenuEmpty>
          <TriggerMenuList>
            {MODELS.map((m) => (
              <TriggerMenuItem<ModelKey>
                key={m.key}
                value={m.key}
                label={m.name}
                keywords={[m.fullName]}
              >
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                <span className="text-xs text-muted-foreground">
                  {m.fullName}
                </span>
                {m.key === model && <CheckIcon aria-hidden />}
              </TriggerMenuItem>
            ))}
          </TriggerMenuList>
        </TriggerMenuContent>
      </TriggerMenu>
      <CantSeeImages
        blind={blind}
        model={chosen.name}
        to={modelOf(DEFAULT_MODEL).name}
        onSwitch={() => onModelChange(DEFAULT_MODEL)}
      />
    </AttachmentsInput>
  )
}

/** Whether the browser has a network, from its online and offline events
 *  alone. It never reads `navigator.onLine`: iOS can report false on a
 *  page that loaded fine (the Simulator did), and a wrong "offline" would
 *  block Send for no reason, which is worse than missing a page that
 *  opened already offline. The server and the first render say yes, so a
 *  page never loads showing the line. */
function useOnline() {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    addEventListener("online", on)
    addEventListener("offline", off)
    return () => {
      removeEventListener("online", on)
      removeEventListener("offline", off)
    }
  }, [])
  return online
}

/** Above the pill while offline, in the gap above it (the new chat's greeting
 *  ends 28px over it, the thread has its own room), so it never covers the
 *  starters under it. The status region is always on the
 *  page and empty until then, since screen readers often skip a live
 *  region that arrives already filled (as CantSeeImages does); the line
 *  people see is hidden from them, so it isn't read twice. */
function OfflineLine({ offline }: { offline: boolean }) {
  const line = "Offline. Reconnecting…"
  return (
    <>
      <p role="status" className="sr-only">
        {offline ? line : ""}
      </p>
      {offline && (
        <p
          aria-hidden
          className="absolute inset-x-0 bottom-full pb-1.5 text-center text-sm text-muted-foreground"
        >
          {line}
        </p>
      )}
    </>
  )
}

/** Send, or Stop while a reply streams: icons alone, named by tooltips. */
function SendOrStop({
  busy,
  ready,
  online,
  onStop,
}: {
  busy: boolean
  ready: boolean
  online: boolean
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
            disabled={!ready || !online}
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
