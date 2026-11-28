// Tabs: ui-sdk's tabs (arrow keys, roles, the selected tab from a value)
// with Grok's Library look: a row of 32px pills in muted ink, 4px apart,
// the selected one on the secondary fill in full ink. A tab can be the
// router's link (`render`), so the address holds the choice; then one
// TabsPanel, valued as the selected tab, holds what it shows.
import type * as React from "react"
import {
  Tabs,
  TabsList as TabsListPrimitive,
  TabsPanel as TabsPanelPrimitive,
  TabsTab as TabsTabPrimitive,
} from "@ui-sdk/react/tabs"

import { cn } from "@/lib/utils"

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsListPrimitive>) {
  return (
    <TabsListPrimitive
      data-slot="tabs-list"
      className={cn("flex gap-1", className)}
      {...props}
    />
  )
}

function TabsTab({
  className,
  ...props
}: React.ComponentProps<typeof TabsTabPrimitive>) {
  return (
    <TabsTabPrimitive
      data-slot="tabs-tab"
      className={cn(
        "flex h-8 press items-center rounded-full px-3 text-sm text-muted-foreground outline-hidden select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-selected:bg-secondary aria-selected:text-foreground",
        className
      )}
      {...props}
    />
  )
}

/** What the selected tab shows: Tab from the list lands on it, drawing
 *  the focus ring the app's controls draw. */
function TabsPanel({
  className,
  ...props
}: React.ComponentProps<typeof TabsPanelPrimitive>) {
  return (
    <TabsPanelPrimitive
      data-slot="tabs-panel"
      className={cn(
        "rounded-xl outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsPanel, TabsTab }
