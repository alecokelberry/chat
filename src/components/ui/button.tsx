// Button: ui-sdk's button (keyboard, focus, and pending while an async
// onClick runs) with the design system's look. Variants arrive with the
// screens that use them.
import type * as React from "react"
import { Button as ButtonPrimitive } from "@ui-sdk/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/** The ink pill: Try again, and Stop. */
const INK =
  "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active"

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 press items-center justify-center gap-2 rounded-full border border-transparent bg-clip-padding text-base font-medium whitespace-nowrap outline-hidden select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        ghost:
          "text-muted-foreground hover:bg-secondary-hover hover:text-foreground active:bg-secondary-active",
        // The page's one main action (Try again): the ink pill.
        primary: INK,
        outline:
          "border-border-strong bg-transparent text-foreground hover:bg-secondary-hover active:bg-secondary-active",
        // The sign-in's passkey pill: the composer's surface and hairline
        // as a 60px pill, a label at the start, and a pink 40px go circle
        // (data-slot="prompt-go") 9px in at the end. While pending it
        // stays at full strength: the passkey sheet is the feedback.
        prompt:
          "h-15 w-full justify-between gap-3 rounded-full border-border-strong bg-surface ps-5 pe-2.25 text-base font-normal text-foreground hover:border-input aria-busy:opacity-100 [&>[data-slot=prompt-go]]:flex [&>[data-slot=prompt-go]]:size-10 [&>[data-slot=prompt-go]]:shrink-0 [&>[data-slot=prompt-go]]:items-center [&>[data-slot=prompt-go]]:justify-center [&>[data-slot=prompt-go]]:rounded-full [&>[data-slot=prompt-go]]:bg-send [&>[data-slot=prompt-go]]:text-primary-foreground [&>[data-slot=prompt-go]_svg]:size-4.5",
        // The composer's go circle: pink to send (the prompt pill's), and
        // with nothing to send Grok's quiet wash and muted arrow; ink to
        // stop a streaming reply.
        send: "bg-send text-primary-foreground hover:bg-send/90 active:bg-send/80 disabled:bg-secondary disabled:text-muted-foreground disabled:opacity-100 aria-disabled:bg-secondary aria-disabled:text-muted-foreground aria-disabled:opacity-100 [&_svg:not([class*='size-'])]:size-4.5",
        stop: `${INK} [&_svg:not([class*='size-'])]:size-3`,
        // A starter under the new chat's composer: a quiet row, an icon
        // then the words, left-aligned, 12px corners; a long one wraps.
        starter:
          "h-auto min-h-10 w-full justify-start gap-3 rounded-xl px-3 py-2 text-start font-normal whitespace-normal text-muted-foreground hover:bg-secondary-hover hover:text-foreground active:bg-secondary-active [&_svg:not([class*='size-'])]:size-5",
        // A Library row: 56px tall, full width, left-aligned, 12px
        // corners, in full ink; hover washes it like a starter.
        file: "h-14 w-full justify-start gap-3 rounded-xl px-3 text-start font-normal text-foreground hover:bg-secondary-hover active:bg-secondary-active",
        // A Library tile (Grid): a square with 12px corners and a hairline
        // on the muted fill, an image filling it or a document's icon,
        // name and kind; hover lifts the fill a step.
        tile: "aspect-square w-full flex-col gap-1 overflow-hidden rounded-xl border-border bg-muted p-2 text-center font-normal whitespace-normal text-foreground hover:bg-secondary-hover active:bg-secondary-active [&_svg:not([class*='size-'])]:size-6 [&>img]:absolute [&>img]:inset-0 [&>img]:size-full [&>img]:object-cover",
        // Floats over the thread (jump to latest): a translucent raised
        // circle.
        float:
          "bg-popover/64 text-foreground shadow-tooltip hover:bg-popover [&_svg:not([class*='size-'])]:size-3.5",
      },
      size: {
        default: "h-9 px-3 py-2 pointer-coarse:h-10",
        // The 32px circle (send, stop, jump to latest), Grok's, at every
        // width: a 40px invisible touch area around it.
        circle: "size-8 after:absolute after:-inset-1",
        sm: "h-8 gap-1.5 px-2.5 text-sm has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2",
        // Grok's reply actions: a 20px pill, 14px glyph, a 36px invisible
        // touch area (40px on touch screens).
        action:
          "size-5 after:absolute after:-inset-2 pointer-coarse:after:-inset-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        // Grok's header buttons (a chat's …): a 28px pill, 20px glyph, a
        // 40px invisible touch area.
        header:
          "size-7 after:absolute after:-inset-1.5 [&_svg:not([class*='size-'])]:size-icon",
        // ✕ and ✓ beside a field being edited: a 24px pill, 14px glyph, a
        // 32px invisible touch area (40px on touch screens).
        edit: "size-6 after:absolute after:-inset-1 pointer-coarse:after:-inset-2 [&_svg:not([class*='size-'])]:size-3.5",
        // A question's image (attachments.tsx): a 64px tile (80px from
        // sm) with 12px corners and a hairline, the image filling it.
        thumbnail:
          "size-16 overflow-hidden rounded-xl border-border sm:size-20 [&>img]:size-full [&>img]:object-cover",
        // The variant brings its own size (prompt, starter).
        none: "",
      },
    },
    defaultVariants: { variant: "ghost", size: "default" },
  }
)

function Button({
  className,
  variant = "ghost",
  size = "default",
  ...props
}: React.ComponentProps<typeof ButtonPrimitive> &
  VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
