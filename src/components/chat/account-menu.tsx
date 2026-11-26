// The account row and its menu, the archived Chat's (Grok's): at the
// bottom of the sidebar, a 40px row with the initials' avatar and the
// name (in the computer's rail, the avatar alone, named in a tooltip). It
// opens a menu above it (a sheet on a phone): the name and email, then
// Theme, which flips light and dark and stays open so its sun and moon
// spin, then Sign out, which lands on /sign-in. Agents ask before signing out
// (data-agent-confirm).
import { useNavigate } from "@tanstack/react-router"
import { LogOutIcon } from "lucide-react"

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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { authClient } from "@/lib/auth/client"

export type Account = { name: string; email: string }

/** Up to two initials: the first word's and the last's. */
function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const first = (word: string | undefined) =>
    Array.from(word ?? "")[0]?.toLocaleUpperCase() ?? ""
  return words.length > 1
    ? first(words[0]) + first(words.at(-1))
    : first(words[0])
}

export function AccountMenu({
  account,
  tooltip = false,
}: {
  account: Account
  /** Named in a tooltip, for the rail, where the name is hidden. */
  tooltip?: boolean
}) {
  const navigate = useNavigate()
  const toggleTheme = useToggleTheme()
  async function signOut() {
    const { error } = await authClient.signOut()
    if (error) throw new Error(error.message ?? "Couldn't sign out")
    await navigate({ to: "/sign-in" })
  }
  return (
    <Menu>
      <Tooltip disabled={!tooltip}>
        <TooltipTrigger
          render={
            <MenuTrigger
              render={
                <SidebarRow variant="account" aria-label={account.name} />
              }
            />
          }
        >
          <Avatar>
            <AvatarFallback>{initialsOf(account.name)}</AvatarFallback>
          </Avatar>
          <span>{account.name}</span>
        </TooltipTrigger>
        <TooltipContent side="right">{account.name}</TooltipContent>
      </Tooltip>
      <MenuContent side="top">
        <MenuGroup>
          <MenuGroupLabel>
            {account.name}
            <small>{account.email}</small>
          </MenuGroupLabel>
        </MenuGroup>
        <MenuSeparator />
        <MenuItem closeOnSelect={false} onSelect={toggleTheme}>
          <ThemeIcon />
          Theme
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
  )
}
