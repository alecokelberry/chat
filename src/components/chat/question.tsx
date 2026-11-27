// A question you sent: its images (attachments.tsx), its bubble on the end
// side (none for images alone), and under it Edit and Copy (on hover or focus; always on touch). Edit turns the bubble into a
// field holding the question, the caret at its end: Enter or ✓ (Save)
// sends it, Shift+Enter starts a new line, and Escape or ✕ (Cancel) puts
// the bubble back unchanged; either way focus returns to Edit. An empty or
// unchanged question just closes. Sending replaces this question and
// everything after it, and the reply is asked again (the chat's onEdit).
// Edit and Save wait while a reply streams.
import { useEffect, useRef, useState, type ComponentProps } from "react"
import { CheckIcon, PencilIcon, XIcon } from "lucide-react"

import type { FileUIPart } from "ai"

import { QuestionImages } from "@/components/chat/attachments"
import { CopyAction, MessageAction } from "@/components/chat/message-action"
import { MessageToolbar } from "@/components/ui/message-toolbar"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export function Question({
  text,
  images,
  busy,
  onEdit,
}: {
  text: string
  /** The images sent with it, shown above the bubble. */
  images: FileUIPart[]
  /** A reply is streaming: editing waits for it. */
  busy: boolean
  /** Asks this question again with new words. */
  onEdit: (text: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const field = useRef<HTMLTextAreaElement>(null)
  const editButton = useRef<HTMLButtonElement>(null)
  // Focus goes back to Edit only after an edit, not when the page opens.
  const wasEditing = useRef(false)

  useEffect(() => {
    const node = field.current
    if (editing && node) {
      wasEditing.current = true
      node.focus()
      node.setSelectionRange(node.value.length, node.value.length)
    } else if (wasEditing.current) editButton.current?.focus()
  }, [editing])

  function close() {
    setEditing(false)
  }

  function save(value = field.current?.value ?? "") {
    if (busy) return
    const next = value.trim()
    close()
    if (next !== "" && next !== text) onEdit(next)
  }

  return (
    <div data-slot="message" className="group/message flex flex-col gap-2.5">
      <QuestionImages images={images} />
      {(editing || text !== "") && (
        <QuestionBubble
          // Room to rewrite a short question.
          className={cn(editing && "w-full")}
        >
          {editing ? (
            <Textarea
              ref={field}
              variant="inline"
              aria-label="Edit question"
              defaultValue={text}
              rows={1}
              autoResize
              submitShortcut="enter"
              onSubmit={(value) => save(value)}
              onKeyDown={(event) => {
                // Escape mid-composition (an input method) ends only that.
                if (event.key === "Escape" && !event.nativeEvent.isComposing)
                  close()
              }}
            />
          ) : (
            text
          )}
        </QuestionBubble>
      )}
      {editing ? (
        <MessageToolbar aria-label="Edit actions" align="end">
          <MessageAction label="Cancel" onClick={close}>
            <XIcon aria-hidden />
          </MessageAction>
          <MessageAction
            label="Save"
            onClick={() => save()}
            disabled={busy}
            confirm="Replaces this question and every reply after it, then asks the model again"
          >
            <CheckIcon aria-hidden />
          </MessageAction>
        </MessageToolbar>
      ) : (
        <MessageToolbar
          aria-label="Question actions"
          reveal="hover"
          align="end"
        >
          <MessageAction
            ref={editButton}
            label="Edit message"
            onClick={() => setEditing(true)}
            disabled={busy}
          >
            <PencilIcon aria-hidden />
          </MessageAction>
          <CopyAction text={text} label="Copy message" />
        </MessageToolbar>
      )}
    </div>
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
