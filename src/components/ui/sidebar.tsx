// The sidebar's parts, with the archived Chat's look (Grok's): a 254px
// column on the page's own plane, a hairline at its end, from md up; on
// phones the same contents in a ui-sdk Drawer from the start edge. Rows
// are 40px at 15px in secondary ink that firms on hover and on the open
// chat. New Chat is raised like the composer and led by its pink plus.
// On a computer the column collapses to a 56px rail (data-collapsed) of
// the toggle and New Chat's plus, sliding with duration-sidebar and
// ease-spring, at once under reduced motion or from the keyboard
// (data-instant).
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
import { useShortcut } from "@ui-sdk/react/shortcuts"
import { cva, type VariantProps } from "class-variance-authority"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipShortcut,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/** The column, from md up. Its parts are the drawer's on phones. */
function Sidebar({
  collapsed = false,
  instant = false,
  className,
  ...props
}: React.ComponentProps<"nav"> & { collapsed?: boolean; instant?: boolean }) {
  return (
    <nav
      data-slot="sidebar"
      data-collapsed={collapsed || undefined}
      data-instant={instant || undefined}
      className={cn(
        "group/sidebar hidden w-sidebar shrink-0 flex-col overflow-hidden border-e border-sidebar-border bg-sidebar text-sidebar-foreground transition-sidebar data-collapsed:w-sidebar-rail data-instant:transition-none motion-reduce:transition-none md:flex",
        className
      )}
      {...props}
    />
  )
}

const TOGGLE_SHORTCUT = "mod+b"

/** The column's top row: its collapse button, Grok's panel glyph, 12px
 *  in. ⌘B (Ctrl+B elsewhere) presses it while `shortcut` is on. */
function SidebarToggle({
  collapsed,
  shortcut,
  onToggle,
}: {
  collapsed: boolean
  shortcut: boolean
  /** `fromKeyboard`: the shortcut pressed it, so nothing animates. */
  onToggle: (fromKeyboard: boolean) => void
}) {
  useShortcut(shortcut ? TOGGLE_SHORTCUT : null, () => onToggle(true), {
    description: "Collapse or expand the sidebar",
  })
  return (
    <div className="flex h-sidebar-header shrink-0 items-center px-3">
      <Tooltip shortcut={TOGGLE_SHORTCUT}>
        <TooltipTrigger
          render={
            <Button
              data-slot="sidebar-toggle"
              variant="ghost"
              size="circle"
              aria-label="Sidebar"
              aria-expanded={!collapsed}
              className="rounded-lg text-sidebar-icon"
              onClick={() => onToggle(false)}
            />
          }
        >
          <PanelLeftIcon aria-hidden className="size-icon" />
        </TooltipTrigger>
        <TooltipContent side="right">
          {collapsed ? "Expand" : "Collapse"}
          <TooltipShortcut className="text-muted-foreground" />
        </TooltipContent>
      </Tooltip>
    </div>
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

/** The 56px row at the top of the phone drawer, holding New Chat. */
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
        // In the rail, only its plus on the sidebar's plane, in a 36px square.
        raised:
          "gap-1.5 bg-popover ps-2.25 pe-3.5 shadow-raised-row ring-1 ring-border-strong group-data-collapsed/sidebar:h-9 group-data-collapsed/sidebar:bg-transparent group-data-collapsed/sidebar:ps-1.5 group-data-collapsed/sidebar:shadow-none group-data-collapsed/sidebar:ring-0 hover:bg-sidebar-accent active:bg-sidebar-accent [&>span]:transition-opacity [&>span]:duration-sidebar [&>span]:ease-spring group-data-collapsed/sidebar:[&>span]:opacity-0 group-data-instant/sidebar:[&>span]:transition-none motion-reduce:[&>span]:transition-none [&>svg]:mx-0.5 [&>svg]:size-5 [&>svg]:shrink-0",
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
  SidebarToggle,
}
