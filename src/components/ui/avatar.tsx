// Avatar: ui-sdk's avatar as a muted circle with the person's initials and
// a hairline ring that darkens (lightens in dark) whatever is under it.
// Every avatar here sits beside the person's name, so it's decorative:
// hidden from screen readers and agents. Sized by where it sits.
import type * as React from "react"
import {
  Avatar as AvatarPrimitive,
  AvatarFallback as AvatarFallbackPrimitive,
} from "@ui-sdk/react/avatar"

import { cn } from "@/lib/utils"

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive>) {
  return (
    <AvatarPrimitive
      aria-hidden
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken dark:after:mix-blend-lighten",
        className
      )}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarFallbackPrimitive>) {
  return (
    <AvatarFallbackPrimitive
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarFallback }
