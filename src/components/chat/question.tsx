// A question you sent: its attachments (attachments.tsx), its bubble on
// the end side (none for images alone), and under it Edit and Copy (on
// hover or focus; always on touch). Edit turns the bubble into a field
// holding the question, the caret at its end: Enter or ✓ (Save) sends it,
// Shift+Enter starts a new line, and Escape or ✕ (Cancel) puts the bubble
// back unchanged; either way focus returns to Edit. An empty or unchanged
// question just closes. Its attachments come along as tiles with ✕, and
// Add files adds more (the composer's rules: up to 4, and Save waits while
// the model can't see an image); Cancel puts them back too. Sending
// replaces this question and everything after it, and the reply is asked
// again (the chat's onEdit). Edit and Save wait while a reply streams.
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ComponentProps,
} from "react"
import { CheckIcon, PencilIcon, PlusIcon, XIcon } from "lucide-react"

import type { FileUIPart } from "ai"

import type { DocumentData } from "@/lib/chat/documents"
import {
  AttachmentsInput,
  AttachmentTiles,
  CantSeeImages,
  QuestionAttachments,
  useAttachments,
} from "@/components/chat/attachments"
import { CopyAction, MessageAction } from "@/components/chat/message-action"
import { MessageToolbar } from "@/components/ui/message-toolbar"
import { Textarea } from "@/components/ui/textarea"
import { DEFAULT_MODEL, modelOf, type ModelKey } from "@/lib/ai/models"
import type { AttachmentPart } from "@/lib/chat/attachments"
import { cn } from "@/lib/utils"

export function Question({
  text,
  images,
  documents,
  busy,
  model,
  onModelChange,
  onEdit,
}: {
  text: string
  /** The images and documents sent with it, shown above the bubble. */
  images: FileUIPart[]
  documents: DocumentData[]
  /** A reply is streaming: editing waits for it. */
  busy: boolean
  /** The model an edit asks, and a way to switch to one that sees. */
  model: ModelKey
  onModelChange: (model: ModelKey) => void
  /** Asks this question again with new words and attachments. */
  onEdit: (text: string, attachments: AttachmentPart[]) => void
}) {
  const [editing, setEditing] = useState(false)
  const editButton = useRef<HTMLButtonElement>(null)
  // Focus goes back to Edit only after an edit, not when the page opens.
  const wasEditing = useRef(false)

  useEffect(() => {
    if (editing) wasEditing.current = true
    else if (wasEditing.current) editButton.current?.focus()
  }, [editing])

  if (editing)
    return (
      <EditQuestion
        text={text}
        initial={[
          ...images,
          ...documents.map((data) => ({
            type: "data-document" as const,
            data,
          })),
        ]}
        busy={busy}
        model={model}
        onModelChange={onModelChange}
        onClose={() => setEditing(false)}
        onSave={onEdit}
      />
    )

  return (
    <div data-slot="message" className="group/message flex flex-col gap-2.5">
      <QuestionAttachments images={images} documents={documents} />
      {text !== "" && <QuestionBubble>{text}</QuestionBubble>}
      <MessageToolbar aria-label="Question actions" reveal="hover" align="end">
        <MessageAction
          ref={editButton}
          label="Edit message"
          onClick={() => setEditing(true)}
          disabled={busy}
        >
          <PencilIcon aria-hidden />
        </MessageAction>
        {/* An image-only question has no words to copy. */}
        {text !== "" && <CopyAction text={text} label="Copy message" />}
      </MessageToolbar>
    </div>
  )
}

/** A question being edited: its attachments as tiles with ✕, its words
 *  in a field, and Add files, Cancel and Save. Closing it drops the changes. */
function EditQuestion({
  text,
  initial,
  busy,
  model,
  onModelChange,
  onClose,
  onSave,
}: {
  text: string
  initial: AttachmentPart[]
  busy: boolean
  model: ModelKey
  onModelChange: (model: ModelKey) => void
  onClose: () => void
  onSave: (text: string, attachments: AttachmentPart[]) => void
}) {
  const field = useRef<HTMLTextAreaElement>(null)
  const [sent] = useState(initial)
  const attachments = useAttachments(sent)
  const chosen = modelOf(model)
  const blind = attachments.hasImages && !chosen.seesImages
  const waiting = busy || attachments.waiting || blind

  useEffect(() => {
    const node = field.current
    node?.focus()
    node?.setSelectionRange(node.value.length, node.value.length)
  }, [])

  // Escape anywhere in it cancels, as from the field: after ✕, focus is
  // on the tiles. Mid-composition (an input method) it ends only that. A
  // listener of its own, since lint keeps key handlers off a plain group;
  // an effect event, so a new onClose doesn't re-attach it.
  const form = useRef<HTMLDivElement>(null)
  const cancel = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape" && !event.isComposing) onClose()
  })
  useEffect(() => {
    const node = form.current
    const listener = (event: KeyboardEvent) => cancel(event)
    node?.addEventListener("keydown", listener)
    return () => node?.removeEventListener("keydown", listener)
  }, [])

  function save(value = field.current?.value ?? "") {
    if (waiting) return
    const next = value.trim()
    const { parts } = attachments
    const same =
      parts.length === sent.length &&
      parts.every((part, index) => part === sent[index])
    onClose()
    if ((next !== "" || parts.length > 0) && (next !== text || !same))
      onSave(next, parts)
  }

  return (
    <AttachmentsInput attachments={attachments} label="Edit attachments">
      <div
        ref={form}
        role="group"
        aria-label="Editing your message"
        data-slot="message"
        className="flex flex-col gap-2.5"
      >
        <AttachmentTiles attachments={attachments} align="end" />
        <QuestionBubble className="w-full">
          <Textarea
            ref={field}
            variant="inline"
            aria-label="Edit question"
            defaultValue={text}
            rows={1}
            autoResize
            submitShortcut="enter"
            onSubmit={(value) => save(value)}
          />
        </QuestionBubble>
        <CantSeeImages
          blind={blind}
          model={chosen.name}
          to={modelOf(DEFAULT_MODEL).name}
          onSwitch={() => onModelChange(DEFAULT_MODEL)}
        />
        <MessageToolbar aria-label="Edit actions" align="end">
          <MessageAction
            label="Add files"
            onClick={() => attachments.controller.open()}
          >
            <PlusIcon aria-hidden />
          </MessageAction>
          <MessageAction label="Cancel" onClick={onClose}>
            <XIcon aria-hidden />
          </MessageAction>
          <MessageAction
            label="Save"
            onClick={() => save()}
            disabled={waiting}
            confirm="Replaces this question and every reply after it, then asks the model again"
          >
            <CheckIcon aria-hidden />
          </MessageAction>
        </MessageToolbar>
      </div>
    </AttachmentsInput>
  )
}

/** A question's bubble, on the end side: in the thread, and read-only in
 *  Search's preview. */
export function QuestionBubble({
  className,
  ...props
}: ComponentProps<"article">) {
  return (
    <article
      aria-label="Your message"
      className={cn(
        "max-w-4/5 self-end rounded-3xl bg-bubble-user px-4 py-3 break-words whitespace-pre-wrap",
        className
      )}
      {...props}
    />
  )
}
