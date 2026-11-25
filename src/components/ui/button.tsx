// Button: ui-sdk's button (keyboard, focus, and pending while an async
// onClick runs) with the design system's look. Variants arrive with the
// screens that use them.
import type * as React from "react"
import { Button as ButtonPrimitive } from "@ui-sdk/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 press items-center justify-center gap-2 rounded-full border border-transparent bg-clip-padding text-base font-medium whitespace-nowrap outline-hidden select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        ghost:
          "text-muted-foreground hover:bg-secondary-hover hover:text-foreground active:bg-secondary-active",
        // The sign-in's passkey pill: the composer's surface and hairline
        // as a 60px pill, a label at the start, and a pink 40px go circle
        // (data-slot="prompt-go") 9px in at the end. While pending it
        // stays at full strength: the passkey sheet is the feedback.
        prompt:
          "h-15 w-full justify-between gap-3 rounded-full border-border-strong bg-surface ps-5 pe-2.25 text-base font-normal text-foreground hover:border-input aria-busy:opacity-100 [&>[data-slot=prompt-go]]:flex [&>[data-slot=prompt-go]]:size-10 [&>[data-slot=prompt-go]]:shrink-0 [&>[data-slot=prompt-go]]:items-center [&>[data-slot=prompt-go]]:justify-center [&>[data-slot=prompt-go]]:rounded-full [&>[data-slot=prompt-go]]:bg-send [&>[data-slot=prompt-go]]:text-primary-foreground [&>[data-slot=prompt-go]_svg]:size-4.5",
      },
      size: {
        default: "h-9 px-3 py-2 pointer-coarse:h-10",
        // The variant brings its own size (prompt).
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

export { Button }
