// The icon buttons in a message's toolbar (a reply's, reply-actions.tsx; a
// question's, question.tsx). Each is named by its tooltip (type="label"),
// so a screen reader hears the name once. CopyAction puts text on the
// clipboard: its icon swaps to a check and its name to "Copied" for a
// moment, and where the browser refuses (a denied permission), nothing
// changes.
import {
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
  type Ref,
} from "react"
import { CheckIcon, CopyIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

type ActionSize = ComponentProps<typeof Button>["size"]
import { MessageToolbarButton } from "@/components/ui/message-toolbar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export function MessageAction({
  ref,
  label,
  onClick,
  disabled,
  confirm,
  size = "action",
  children,
}: {
  ref?: Ref<HTMLButtonElement>
  label: string
  onClick: () => void
  disabled?: boolean
  /** What it does, for an agent to ask a person first. */
  confirm?: string
  /** The button's size: a reply's 20px, or a card's (code 24px, table 28px). */
  size?: ActionSize
  children: ReactNode
}) {
  return (
    <Tooltip type="label">
      <TooltipTrigger
        render={
          <MessageToolbarButton
            ref={ref}
            onClick={onClick}
            disabled={disabled}
            // Still focusable, so its tooltip reaches keyboards too
            // (ui-sdk's Tooltip docs, Disabled buttons).
            focusableWhenDisabled
            data-agent-confirm={confirm}
            render={<Button variant="ghost" size={size} />}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

export function CopyAction({
  text,
  label,
  size,
  glyph,
}: {
  size?: ActionSize
  /** The glyph's size class, where the size's own isn't right (a code card's 16px). */
  glyph?: string
  /** What to copy; a function reads it at the press (a table's rows). */
  text: string | (() => string)
  /** Says what it copies, as it differs where it sits ("Copy code"). */
  label: string
}) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])

  return (
    <MessageAction
      label={copied ? "Copied" : label}
      size={size}
      onClick={() => {
        navigator.clipboard
          .writeText(typeof text === "function" ? text() : text)
          .then(
            () => setCopied(true),
            () => undefined
          )
      }}
    >
      <span className="grid *:col-start-1 *:row-start-1 *:transition-swap">
        <CopyIcon
          aria-hidden
          className={cn(glyph, copied && "scale-50 opacity-0")}
        />
        <CheckIcon
          aria-hidden
          className={cn(glyph, !copied && "scale-50 opacity-0")}
        />
      </span>
    </MessageAction>
  )
}
