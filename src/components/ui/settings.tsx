// Settings' look (the window itself is src/components/chat/settings.tsx),
// Grok's settings in the sidebar's own terms: a left nav as wide as the
// sidebar, a hairline from the page, its rows the sidebar's 40px rows
// (rounded-item, ink-secondary, the sidebar's wash on hover and for the
// open section), under a 40px search box. The page beside it: the
// section's name at 20px, then cards (a hairline, 16px corners) of rows,
// each a name over a muted line at the start and its control at the end,
// a hairline between them; a muted label above a card names it.
// On a phone (below md) the nav and the page take turns in the sheet:
// `page` on SettingsLayout shows the page, with a back button at its top;
// without it, the nav, each row ending in a chevron, as iPhone Settings'.
import type * as React from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"
import { InputClear, InputGroup } from "@ui-sdk/react/input"
import {
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
  TabsTabIcon,
} from "@ui-sdk/react/tabs"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** The nav and the page, side by side from md; `page` shows the page on a
 *  phone. Tabs underneath: the nav's rows select the page. */
function SettingsLayout({
  page,
  className,
  ...props
}: React.ComponentProps<typeof Tabs> & { page: boolean }) {
  return (
    <Tabs
      orientation="vertical"
      data-page={page ? "" : undefined}
      className={cn(
        "group/settings flex min-h-0 flex-1 md:flex-row",
        className
      )}
      {...props}
    />
  )
}

/** The left column: the search box and the sections. */
function SettingsNav({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="settings-nav"
      className={cn(
        "flex min-h-0 w-full flex-col gap-2 p-2.5 group-data-page/settings:max-md:hidden md:w-sidebar md:shrink-0 md:border-e md:border-sidebar-border",
        className
      )}
      {...props}
    />
  )
}

/** The search box: ui-sdk's InputGroup with a magnifier, the field, and
 *  its Clear (✕) once something's typed, which empties it and keeps focus
 *  in the field. */
function SettingsSearch(props: React.ComponentProps<typeof Input>) {
  return (
    <InputGroup
      data-slot="settings-search"
      className="flex h-10 shrink-0 cursor-text items-center gap-2 rounded-item border border-border-strong ps-3 pe-1.5 text-muted-foreground focus-within:border-ring [&>svg]:size-4 [&>svg]:shrink-0"
    >
      <SearchIcon aria-hidden />
      <Input
        type="search"
        autoComplete="off"
        className="[&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      <InputClear
        aria-label="Clear search"
        className="relative flex size-6 shrink-0 items-center justify-center rounded-full outline-hidden not-data-filled:hidden after:absolute after:-inset-1 hover:bg-secondary-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:after:-inset-2 [&>svg]:size-3.5"
      >
        <XIcon aria-hidden />
      </InputClear>
    </InputGroup>
  )
}

/** The sections, named for screen readers and agents. */
function SettingsNavList({
  className,
  ...props
}: React.ComponentProps<typeof TabsList>) {
  return (
    <TabsList
      className={cn("flex min-h-0 flex-col gap-px overflow-y-auto", className)}
      {...props}
    />
  )
}

/** A section's row: its icon and name, the sidebar's row. */
function SettingsNavItem({
  icon,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<typeof TabsTab>, "children"> & {
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <TabsTab
      className={cn(
        "flex h-10 w-full shrink-0 press items-center gap-2 rounded-item px-3 text-start text-base whitespace-nowrap text-ink-secondary ring-sidebar-ring outline-hidden select-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent md:data-selected:bg-sidebar-accent md:data-selected:text-sidebar-accent-foreground [&_svg]:size-icon [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      <TabsTabIcon>{icon}</TabsTabIcon>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <ChevronRightIcon aria-hidden className="text-sidebar-icon md:hidden" />
    </TabsTab>
  )
}

/** What the search box says when no section matches. */
function SettingsNavEmpty({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("px-3 py-2.5 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

/** A section's page: its name (with back, on a phone), then its cards. */
function SettingsPage({
  title,
  onBack,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof TabsPanel>, "children"> & {
  children: React.ReactNode
  title: string
  /** Back to the sections, on a phone. */
  onBack: () => void
}) {
  return (
    <TabsPanel
      className={cn(
        "min-h-0 flex-1 overflow-y-auto px-4 pb-6 outline-hidden not-group-data-page/settings:max-md:hidden md:px-6",
        className
      )}
      {...props}
    >
      <div className="flex h-14 items-center gap-1 md:h-16">
        <Button
          size="header"
          aria-label="Back to settings"
          className="-ms-1.5 md:hidden"
          onClick={onBack}
        >
          <ChevronLeftIcon aria-hidden />
        </Button>
        <h2 className="truncate text-2xl">{title}</h2>
      </div>
      <div className="flex flex-col gap-6">{children}</div>
    </TabsPanel>
  )
}

/** A card of rows, with a muted label above it when `label` is given. */
function SettingsCard({
  label,
  className,
  children,
  ...props
}: React.ComponentProps<"section"> & { label?: string }) {
  return (
    <section
      data-slot="settings-card"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    >
      {label !== undefined && (
        <h3 className="px-3 text-sm text-muted-foreground">{label}</h3>
      )}
      <div className="flex flex-col rounded-2xl border border-border-strong">
        {children}
      </div>
    </section>
  )
}

/** A row in a card: `leading` (an avatar) at the start, the name over its
 *  muted `description`, and the control (`children`) at the end. */
function SettingsRow({
  name,
  description,
  leading,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "name"> & {
  name: React.ReactNode
  description?: React.ReactNode
  leading?: React.ReactNode
}) {
  return (
    <div
      data-slot="settings-row"
      className={cn(
        "flex min-h-16 items-center gap-3 px-4 py-3 not-first:border-t not-first:border-border [&>[data-slot=avatar]]:size-10 [&>[data-slot=avatar]_*]:text-base",
        className
      )}
      {...props}
    >
      {leading}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base text-foreground">{name}</span>
        {description !== undefined && (
          <span className="truncate text-sm text-muted-foreground">
            {description}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

export {
  SettingsCard,
  SettingsLayout,
  SettingsNav,
  SettingsNavEmpty,
  SettingsNavItem,
  SettingsNavList,
  SettingsPage,
  SettingsRow,
  SettingsSearch,
}
