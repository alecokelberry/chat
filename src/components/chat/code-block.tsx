// A reply's code block, wrapped around Streamdown's own (its highlighting
// and language label are kept): Copy sits in the 32px header at the end,
// and code longer than 16 lines folds behind Show more / Show less. This
// is Streamdown's `code` override (reply.tsx); an inline `code` passes
// straight through. The fold counts lines of the finished block, so a
// block still being written never folds under the reader.
import { useState, type ComponentProps } from "react"
import { defaultComponents, useIsCodeFenceIncomplete } from "streamdown"

import { CopyAction } from "@/components/chat/message-action"
import { Button } from "@/components/ui/button"
import { MessageToolbar } from "@/components/ui/message-toolbar"

const FOLD_LINES = 16

/** The code's text: Streamdown hands a block's source over as a string, or
 *  as an element holding one. */
function codeText(children: unknown): string {
  if (typeof children === "string") return children
  if (
    typeof children === "object" &&
    children !== null &&
    "props" in children &&
    typeof children.props === "object" &&
    children.props !== null &&
    "children" in children.props &&
    typeof children.props.children === "string"
  ) {
    return children.props.children
  }
  return ""
}

export function Code(props: ComponentProps<typeof defaultComponents.code>) {
  if (!("data-block" in props)) return <defaultComponents.code {...props} />
  return <Block {...props} />
}

function Block(props: ComponentProps<typeof defaultComponents.code>) {
  const code = codeText(props.children)
  const incomplete = useIsCodeFenceIncomplete()
  const [open, setOpen] = useState(false)
  const foldable =
    !incomplete && code.replace(/\n$/, "").split("\n").length > FOLD_LINES
  return (
    <div
      data-slot="code-block"
      data-folded={foldable && !open ? "" : undefined}
      className="relative"
    >
      <defaultComponents.code {...props} />
      {code !== "" && (
        <MessageToolbar
          aria-label="Code actions"
          className="absolute end-1.5 top-1 h-6"
        >
          <CopyAction text={code.replace(/\n$/, "")} />
        </MessageToolbar>
      )}
      {foldable && (
        <div className="flex h-9 items-center justify-center border-t border-border-strong">
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? "Show less" : "Show more"}
          </Button>
        </div>
      )}
    </div>
  )
}
