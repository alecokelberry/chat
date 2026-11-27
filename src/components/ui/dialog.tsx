// Dialog: ui-sdk's dialog (focus trap, Escape and outside press, return
// focus, scroll lock) as a raised panel over a dimmed page: the popover
// fill, a hairline, 20px corners and the dialog shadow, 640px wide and
// 12% of the screen from the top, like a command palette, so its height can change
// without it jumping around the screen's middle. It appears at once: it's
// opened from the keyboard as often as not (⌘K), and keyboard actions
// never animate (DESIGN.md › Motion); only the scrim fades. On a touch
// phone it's a sheet from the bottom instead (presentation "auto"), with
// the grab handle, nearly the visible height (above the keyboard, which
// ui-sdk lifts it by), its fill carried below its edge (sheet-bleed), and
// moved only by ui-sdk's own translate.
import type * as React from "react"
import { useShortcut } from "@ui-sdk/react/shortcuts"
import {
  Dialog as DialogPrimitive,
  DialogBackdrop as DialogBackdropPrimitive,
  DialogContent as DialogContentPrimitive,
  DialogTitle,
  createDialogController,
} from "@ui-sdk/react/dialog"

import { cn } from "@/lib/utils"

type DialogController = ReturnType<typeof createDialogController>

/** `shortcut` opens the dialog from anywhere on the page, even from a
 *  text field (through `open`, if it must load something first), and
 *  closes it again from inside `content` (its DialogContent): a modal
 *  pauses the page's own shortcuts while open. */
function useDialogShortcut(
  controller: DialogController,
  shortcut: string,
  content: React.RefObject<HTMLElement | null>,
  description: string,
  open: () => void = () => void controller.open()
) {
  useShortcut(shortcut, open, {
    description,
    allowInInput: true,
  })
  useShortcut(shortcut, () => controller.close(), {
    layer: content,
    allowInInput: true,
  })
}

function Dialog(props: React.ComponentProps<typeof DialogPrimitive>) {
  return <DialogPrimitive presentation="auto" {...props} />
}

function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogContentPrimitive>) {
  return (
    <>
      <DialogBackdropPrimitive className="fixed inset-0 bg-overlay transition-opacity duration-pane ease-standard data-ending-style:opacity-0 data-starting-style:opacity-0 data-[presentation=sheet]:hidden" />
      <DialogContentPrimitive
        className={cn(
          "flex flex-col overflow-hidden border border-border-strong bg-popover text-popover-foreground outline-hidden",
          "data-[presentation=dialog]:fixed data-[presentation=dialog]:inset-x-4 data-[presentation=dialog]:top-dialog-top data-[presentation=dialog]:mx-auto data-[presentation=dialog]:max-h-dialog-height data-[presentation=dialog]:max-w-dialog data-[presentation=dialog]:rounded-overlay data-[presentation=dialog]:shadow-dialog",
          "data-[presentation=sheet]:sheet-handle data-[presentation=sheet]:sheet-tall data-[presentation=sheet]:w-full data-[presentation=sheet]:rounded-t-overlay data-[presentation=sheet]:border-b-0 data-[presentation=sheet]:pt-2 data-[presentation=sheet]:sheet-bleed",
          className
        )}
        {...props}
      >
        {children}
      </DialogContentPrimitive>
    </>
  )
}

export {
  Dialog,
  DialogContent,
  DialogTitle,
  createDialogController,
  useDialogShortcut,
  type DialogController,
}
