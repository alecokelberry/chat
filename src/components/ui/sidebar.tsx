// The sidebar's parts, with the archived Chat's look (Grok's): a 254px
// column on the page's own plane, a hairline at its end, from md up; on
// phones the same contents in a ui-sdk Drawer from the start edge. Rows
// are 40px at 15px in secondary ink that firms on hover and on the open
// chat. New Chat is raised like the composer and led by its pink plus.
// On a computer the column collapses to a 56px rail (data-collapsed) of
// the toggle, New Chat's plus and the account's avatar, sliding with
// duration-sidebar and ease-spring, at once under reduced motion or from the keyboard
// (data-instant).
// A row is a ui-sdk Button rendering the router's link (ui-sdk's Button
// docs, Links): a real link to browsers and screen readers, and a control
// agents can find and press. A chat row's … (SidebarRowAction) sits over
// its end: shown on hover, on focus and while its menu is open, and
// always on touch screens, which have no hover; the title makes room for
// it. While a chat is renamed, SidebarRowEdit takes the row's place.
// The chats below Pinned sit in a SidebarSection, Grok's Chats header: its
// 14px muted label and chevron fold the rows (ui-sdk's Collapsible, its
// height animating like a reply step's), with 24px icon buttons at its end
// (SidebarSectionAction) lined up with the rows' …; a "more" row ends a
// long list.
import * as React from "react"
import { ChevronDownIcon, PanelLeftIcon, SearchIcon } from "lucide-react"
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@ui-sdk/react/collapsible"
import {
  Drawer,
  DrawerBackdrop,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@ui-sdk/react/drawer"
import { Button as ButtonPrimitive } from "@ui-sdk/react/button"
import { BrandMark } from "@/components/ui/brand-mark"
import { useShortcut } from "@ui-sdk/react/shortcuts"
import { cva, type VariantProps } from "class-variance-authority"

import { Button, buttonVariants } from "@/components/ui/button"
import { MenuTrigger } from "@/components/ui/menu"
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

/** ⌘J (Ctrl+J elsewhere) starts a new chat from anywhere, even from the
 *  composer. */
const NEW_CHAT_SHORTCUT = "mod+j"

function useNewChatShortcut(onNewChat: () => void) {
  useShortcut(NEW_CHAT_SHORTCUT, onNewChat, {
    description: "New chat",
    allowInInput: true,
  })
}

/** The column's top row: its collapse button, Grok's panel glyph, 12px
 *  in, then `children` (Search), which the rail has no room for. ⌘B
 *  (Ctrl+B elsewhere) presses it while `shortcut` is on. */
function SidebarToggle({
  collapsed,
  shortcut,
  onToggle,
  children,
}: {
  collapsed: boolean
  shortcut: boolean
  /** `fromKeyboard`: the shortcut pressed it, so nothing animates. */
  onToggle: (fromKeyboard: boolean) => void
  children?: React.ReactNode
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
          <TooltipShortcut />
        </TooltipContent>
      </Tooltip>
      <div className="ms-1 flex group-data-collapsed/sidebar:hidden">
        {children}
      </div>
      {/* The app's mark, at the column's end; the rail has no room. */}
      <BrandMark
        tone="icon"
        className="ms-auto me-1 size-icon group-data-collapsed/sidebar:hidden"
      />
    </div>
  )
}

/** Search's icon, a 32px circle like the toggle's, that opens Search
 *  (`onOpen`). Its tooltip names `shortcut`, unless `tooltip` is off (a
 *  finger has no hover). None of them is the dialog's own trigger: ui-sdk
 *  names a dialog after its trigger and can't pick one of three, and the
 *  dialog itself loads only once Search is about to open, so each opens it
 *  through its controller, which returns focus to it all the same. */
function SidebarSearchTrigger({
  shortcut,
  tooltip = true,
  tooltipSide = "bottom",
  onIntent,
  onOpen,
}: {
  shortcut: string
  tooltip?: boolean
  /** Where the tooltip shows: beside the icon in the rail. */
  tooltipSide?: "bottom" | "right"
  /** The pointer or focus arrived: Search may open next. */
  onIntent?: () => void
  onOpen: () => void
}) {
  return (
    <Tooltip disabled={!tooltip} shortcut={shortcut}>
      <TooltipTrigger
        render={
          <Button
            data-slot="sidebar-search"
            variant="ghost"
            size="circle"
            aria-label="Search"
            aria-haspopup="dialog"
            className="rounded-lg text-sidebar-icon"
            onPointerEnter={onIntent}
            onPointerDown={onIntent}
            onFocus={onIntent}
            onClick={onOpen}
          />
        }
      >
        <SearchIcon aria-hidden className="size-icon" />
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>
        Search
        <TooltipShortcut />
      </TooltipContent>
    </Tooltip>
  )
}

/** The phone sidebar: a Drawer from the start edge. Its trigger and
 *  content go inside. */
function SidebarDrawer(
  props: Omit<React.ComponentProps<typeof Drawer>, "side">
) {
  return <Drawer side="start" {...props} />
}

/** The phone header's button that opens the drawer: Grok's panel glyph,
 *  in the same rounded square as the computer's sidebar button. */
function SidebarDrawerTrigger(
  props: React.ComponentProps<typeof DrawerTrigger>
) {
  return (
    <DrawerTrigger
      data-slot="sidebar-trigger"
      aria-label="Open sidebar"
      className={cn(buttonVariants({ size: "circle" }), "rounded-lg")}
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

/** The bottom of the column and the drawer, holding the account. */
function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn("mt-auto shrink-0 px-2.5 pb-2", className)}
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

/** A section of the list under a header that folds it: `label` and its
 *  chevron (pointing down while open), then `actions` at the header's end,
 *  lined up with the rows' …. */
function SidebarSection({
  label,
  open,
  onOpenChange,
  actions,
  children,
}: {
  label: string
  open: boolean
  onOpenChange: (open: boolean) => void
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const id = React.useId()
  return (
    <Collapsible
      data-slot="sidebar-section"
      open={open}
      onOpenChange={onOpenChange}
      render={<section aria-labelledby={id} />}
      className="flex flex-col pt-1.5"
    >
      <div className="mx-2.5 flex h-8 items-center">
        <h2 className="flex min-w-0">
          <CollapsibleTrigger
            id={id}
            className="group/section flex h-8 items-center gap-1 rounded-md ps-2.25 pe-1.5 text-sm text-sidebar-muted ring-sidebar-ring outline-hidden select-none hover:text-sidebar-foreground focus-visible:ring-2"
          >
            {label}
            <ChevronDownIcon
              aria-hidden
              className="size-3.5 transition-transform duration-fast ease-standard group-data-closed/section:-rotate-90 rtl:group-data-closed/section:rotate-90"
            />
          </CollapsibleTrigger>
        </h2>
        <div className="ms-auto flex items-center gap-0.5 pe-1.5">
          {actions}
        </div>
      </div>
      <CollapsiblePanel className="h-(--collapsible-panel-height) overflow-hidden transition-collapse data-ending-style:h-0 data-starting-style:h-0">
        {children}
      </CollapsiblePanel>
    </Collapsible>
  )
}

/** One of a section header's 24px icon buttons, like the rows' …: the
 *  sidebar's icon ink and 16px glyph, the row's wash under the pointer and
 *  while its menu is open, and a 40px invisible touch area on touch
 *  screens. */
function SidebarSectionAction({
  className,
  ...props
}: React.ComponentProps<typeof ButtonPrimitive>) {
  return (
    <ButtonPrimitive
      data-slot="sidebar-section-action"
      className={cn(
        "relative flex size-6 press items-center justify-center rounded-md text-sidebar-icon ring-sidebar-ring outline-hidden select-none after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 active:bg-sidebar-accent data-open:bg-sidebar-accent data-open:text-sidebar-foreground pointer-fine:after:hidden [&>svg]:size-4 [&>svg]:shrink-0",
        className
      )}
      {...props}
    />
  )
}

function SidebarItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-item"
      className={cn("group/item relative mx-1", className)}
      {...props}
    />
  )
}

/** A chat row's 24px …, its menu's trigger, 6px from its end, with a
 *  rounded square behind it (the row's wash, stacked on the row's own)
 *  while it's hovered or its menu is open; a 40px invisible touch area on
 *  touch screens, where the open menu is a sheet and the row's wash alone
 *  marks its chat (no square on the …). The trigger is the button
 *  itself, not a Button inside it, so an agent sees one control per row's
 *  menu, not two. */
function SidebarRowAction({
  className,
  ...props
}: React.ComponentProps<typeof MenuTrigger>) {
  return (
    <MenuTrigger
      data-slot="sidebar-row-action"
      className={cn(
        "absolute end-1.5 top-2 flex size-6 items-center justify-center rounded-md text-sidebar-icon opacity-0 ring-sidebar-ring outline-hidden select-none no-touch-callout group-focus-within/item:opacity-100 group-hover/item:opacity-100 after:absolute after:-inset-2 hover:text-sidebar-foreground focus-visible:opacity-100 focus-visible:ring-2 data-open:text-sidebar-foreground data-open:opacity-100 pointer-coarse:opacity-100 pointer-fine:after:hidden pointer-fine:hover:bg-sidebar-accent pointer-fine:data-open:bg-sidebar-accent [&>svg]:size-3.5 [&>svg]:shrink-0",
        className
      )}
      {...props}
    />
  )
}

/** A chat row being renamed: the row's 40px and wash, holding the field
 *  (where the title sat) and its ✕ ✓. */
function SidebarRowEdit({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-row-edit"
      className={cn(
        "flex h-10 w-full items-center gap-2 rounded-item bg-sidebar-accent ps-3 pe-2 text-sidebar-accent-foreground",
        className
      )}
      {...props}
    />
  )
}

const sidebarRowVariants = cva(
  "flex h-10 w-full press items-center rounded-item py-1.5 text-base font-normal whitespace-nowrap text-ink-secondary ring-sidebar-ring outline-hidden select-none no-touch-callout focus-visible:ring-2",
  {
    variants: {
      variant: {
        // New Chat, Grok's: raised off the sidebar (surface fill, a
        // hairline, a soft drop), 9px in and 14px at the end, led by its
        // 20px pink plus; hover deepens the fill.
        // In the rail, only its plus on the sidebar's plane, in a 36px square.
        raised:
          "gap-1.5 bg-popover ps-2.25 pe-3.5 shadow-raised-row group-data-collapsed/sidebar:h-9 group-data-collapsed/sidebar:bg-transparent group-data-collapsed/sidebar:ps-1.5 group-data-collapsed/sidebar:shadow-none hover:bg-sidebar-accent active:bg-sidebar-accent [&>span]:transition-opacity [&>span]:duration-sidebar [&>span]:ease-spring group-data-collapsed/sidebar:[&>span]:opacity-0 group-data-instant/sidebar:[&>span]:transition-none motion-reduce:[&>span]:transition-none [&>svg]:mx-0.5 [&>svg]:size-icon [&>svg]:shrink-0",
        // The account, Grok's: a 26px avatar (12px initials) and the name,
        // medium in full ink, 8px in, in a muted row; hover and open fill the row at once
        // with the chat rows' wash, and the avatar dims to 75%. In the rail, the avatar alone in a
        // 36px circle.
        account:
          "gap-2 rounded-item px-2 font-medium text-muted-foreground group-data-collapsed/sidebar:size-9 group-data-collapsed/sidebar:gap-0 group-data-collapsed/sidebar:rounded-full group-data-collapsed/sidebar:p-1.25 hover:bg-sidebar-accent hover:text-foreground active:bg-sidebar-accent active:text-foreground aria-expanded:bg-sidebar-accent aria-expanded:text-foreground [&>[data-slot=avatar]]:size-6.5 [&>[data-slot=avatar]]:transition-opacity [&>[data-slot=avatar]]:duration-fast [&>[data-slot=avatar]]:ease-standard hover:[&>[data-slot=avatar]]:opacity-75 [&>[data-slot=avatar]_*]:text-xs [&>span:last-child]:truncate [&>span:last-child]:text-foreground group-data-collapsed/sidebar:[&>span:last-child]:hidden",
        // A chat: its title only, 12px in and 8px at the end (36px while
        // its … shows), fading out at the end instead of an ellipsis. The
        // open chat (the link's aria-current) keeps the hover's wash and
        // full ink, and so does a row while its menu is open.
        // Show more: a chat row's place and inset, in muted ink.
        more: "ps-3 pe-2 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent",
        chat: "ps-3 pe-2 group-focus-within/item:pe-9 group-hover/item:pe-9 group-has-data-open/item:bg-sidebar-accent group-has-data-open/item:pe-9 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground pointer-coarse:pe-9 [&>span]:min-w-0 [&>span]:flex-1 [&>span]:overflow-hidden [&>span]:mask-row-fade",
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
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarRow,
  SidebarRowAction,
  SidebarRowEdit,
  SidebarSearchTrigger,
  SidebarSection,
  SidebarSectionAction,
  SidebarToggle,
  NEW_CHAT_SHORTCUT,
  useNewChatShortcut,
}
