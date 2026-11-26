// The sidebar's parts, with the archived Chat's look (Grok's): a 254px
// column on the page's own plane, a hairline at its end, from md up; on
// phones the same contents in a ui-sdk Drawer from the start edge. Rows
// are 40px at 15px in secondary ink that firms on hover and on the open
// chat. New Chat is raised like the composer and led by its pink plus.
// A row is a ui-sdk Button rendering the router's link (ui-sdk's Button
// docs, Links): a real link to browsers and screen readers, and a control
// agents can find and press.
import * as React from "react"
import { PanelLeftIcon } from "lucide-react"
import {
  Drawer,
  DrawerBackdrop,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@ui-sdk/react/drawer"
import { Button as ButtonPrimitive } from "@ui-sdk/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** The column, from md up. Its parts are the drawer's on phones. */
function Sidebar({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="sidebar"
      className={cn(
        "hidden w-sidebar shrink-0 flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground md:flex",
        className
      )}
      {...props}
    />
  )
}

/** The phone sidebar: a Drawer from the start edge. Its trigger and
 *  content go inside. */
function SidebarDrawer(
  props: Omit<React.ComponentProps<typeof Drawer>, "side">
) {
  return <Drawer side="start" {...props} />
}

/** The phone header's button that opens the drawer: Grok's panel glyph. */
function SidebarDrawerTrigger(
  props: React.ComponentProps<typeof DrawerTrigger>
) {
  return (
    <DrawerTrigger
      data-slot="sidebar-trigger"
      aria-label="Open sidebar"
      className={buttonVariants({ size: "circle" })}
      {...props}
    >
      <PanelLeftIcon className="size-icon" />
    </DrawerTrigger>
  )
}

/** The drawer's sheet: the column's look at full height, clear of the
 *  notch and home indicator, over a dimmed page. Named for screen readers
 *  only. */
function SidebarDrawerContent({
  title,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof DrawerContent>, "children"> & {
  title: string
  children: React.ReactNode
}) {
  return (
    <>
      <DrawerBackdrop className="fixed inset-0 z-40 bg-overlay" />
      <DrawerContent
        data-slot="sidebar"
        className={cn(
          "flex h-full w-sidebar flex-col bg-sidebar pt-safe pb-safe text-sidebar-foreground shadow-dialog outline-hidden",
          className
        )}
        {...props}
      >
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        {children}
      </DrawerContent>
    </>
  )
}

/** The 56px row at the top, holding New Chat. */
function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn(
        "flex h-sidebar-header shrink-0 items-center px-2.5",
        className
      )}
      {...props}
    />
  )
}

/** A group of rows under its label, 6px in. */
function SidebarGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  const id = React.useId()
  return (
    <section
      data-slot="sidebar-group"
      aria-labelledby={id}
      className="flex flex-col px-1.5 py-0.5"
    >
      <h2
        id={id}
        className="mx-1 ps-2.25 pe-3 pt-2.5 pb-1 text-xs font-medium text-sidebar-muted select-none"
      >
        {label}
      </h2>
      <ul className="flex flex-col gap-px">{children}</ul>
    </section>
  )
}

function SidebarItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li data-slot="sidebar-item" className={cn("mx-1", className)} {...props} />
  )
}

const sidebarRowVariants = cva(
  "flex h-10 w-full press items-center rounded-xl py-1.5 text-base font-normal whitespace-nowrap text-ink-secondary ring-sidebar-ring outline-hidden focus-visible:ring-2",
  {
    variants: {
      variant: {
        // New Chat, Grok's: raised off the sidebar (surface fill, a
        // hairline, a soft drop), 9px in and 14px at the end, led by its
        // 20px pink plus; hover deepens the fill.
        raised:
          "gap-1.5 bg-popover ps-2.25 pe-3.5 shadow-raised-row ring-1 ring-border-strong hover:bg-sidebar-accent active:bg-sidebar-accent [&>svg]:mx-0.5 [&>svg]:size-5 [&>svg]:shrink-0",
        // A chat: its title only, 12px in and 8px at the end, fading out
        // at the end instead of an ellipsis. The open chat (the link's
        // aria-current) keeps the hover's wash and full ink.
        chat: "ps-3 pe-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground [&>span]:min-w-0 [&>span]:flex-1 [&>span]:overflow-hidden [&>span]:mask-row-fade",
      },
    },
    defaultVariants: { variant: "chat" },
  }
)

/** A row: pass the link as `render`. */
function SidebarRow({
  variant,
  className,
  ...props
}: React.ComponentProps<typeof ButtonPrimitive> &
  VariantProps<typeof sidebarRowVariants>) {
  return (
    <ButtonPrimitive
      data-slot="sidebar-row"
      className={cn(sidebarRowVariants({ variant }), className)}
      {...props}
    />
  )
}

export {
  Sidebar,
  SidebarDrawer,
  SidebarDrawerContent,
  SidebarDrawerTrigger,
  SidebarGroup,
  SidebarHeader,
  SidebarItem,
  SidebarRow,
}
