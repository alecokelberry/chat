// The account row and its menu, the archived Chat's (Grok's): at the
// bottom of the sidebar, a 40px row with the initials' avatar and the
// name (in the computer's rail, the avatar alone, named in a tooltip). It
// opens a menu above it (a sheet on a phone): the name and email, then
// Settings (src/components/chat/settings.tsx), then Theme, which flips light and dark and stays open so its sun and moon
// spin, Feature tour, which adds the pinned demo chat (src/lib/chat/tour.ts)
// or refreshes it, and opens it, then Sign out, which lands on /sign-in. Agents ask before signing out
// (data-agent-confirm).
import { useNavigate, useRouter } from "@tanstack/react-router"
import { CompassIcon, LogOutIcon, SettingsIcon } from "lucide-react"

import type { SettingsController } from "@/components/chat/settings-dialog"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu"
import { useToggleTheme } from "@/components/ui/preferences"
import { SidebarRow } from "@/components/ui/sidebar"
import { ThemeIcon } from "@/components/ui/theme-icon"
import { toast } from "@/components/ui/toast"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useSignOut } from "@/lib/auth/use-sign-out"
import { addTour } from "@/lib/chat/list"
import { initialsOf } from "@/lib/settings/initials"

export type Account = { name: string; email: string }

export function AccountMenu({
  account,
  settings,
  tooltip = false,
  onOpenChat,
}: {
  account: Account
  /** Opens Settings, from the menu's Settings. */
  settings: SettingsController
  /** Named in a tooltip, for the rail, where the name is hidden. */
  tooltip?: boolean
  /** Feature tour opened its chat: the phone's drawer closes, as it does
   *  for a row. */
  onOpenChat?: () => void
}) {
  const navigate = useNavigate()
  const router = useRouter()
  const toggleTheme = useToggleTheme()
  const signOut = useSignOut()
  async function openTour() {
    try {
      const id = await addTour()
      await router.invalidate()
      await navigate({ to: "/c/$id", params: { id } })
      onOpenChat?.()
    } catch {
      toast.error("Couldn't add the feature tour")
    }
  }
  return (
    <>
      <Menu>
        <Tooltip disabled={!tooltip}>
          <TooltipTrigger
            render={
              <MenuTrigger
                render={
                  <SidebarRow
                    variant="account"
                    aria-label={tooltip ? account.name : undefined}
                  />
                }
              />
            }
          >
            <Avatar aria-hidden>
              <AvatarFallback>{initialsOf(account.name)}</AvatarFallback>
            </Avatar>
            <span>{account.name}</span>
          </TooltipTrigger>
          <TooltipContent side="right">{account.name}</TooltipContent>
        </Tooltip>
        {/* As wide as its row, inside the column's margins; the rail's
            avatar is too narrow to set it, so there it's the usual 256px. */}
        {/* D flips the theme with this menu open (data-theme-menu,
            preferences.tsx), and it stays open, as it does for Theme. */}
        <MenuContent
          side="top"
          data-theme-menu
          className={
            tooltip
              ? undefined
              : "data-[presentation=popover]:w-(--anchor-width)"
          }
        >
          <MenuGroup>
            <MenuGroupLabel>
              {account.name}
              <small>{account.email}</small>
            </MenuGroupLabel>
          </MenuGroup>
          <MenuSeparator />
          <MenuItem onSelect={() => void settings.open({ payload: "account" })}>
            <SettingsIcon aria-hidden />
            Settings
          </MenuItem>
          <MenuItem closeOnSelect={false} onSelect={toggleTheme}>
            <ThemeIcon />
            Theme
          </MenuItem>
          <MenuItem onSelect={openTour}>
            <CompassIcon aria-hidden />
            Feature tour
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            data-agent-confirm="Signs you out on this device"
            onSelect={signOut}
          >
            <LogOutIcon aria-hidden />
            Sign out
          </MenuItem>
        </MenuContent>
      </Menu>
    </>
  )
}
