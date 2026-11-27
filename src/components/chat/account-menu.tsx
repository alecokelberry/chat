// The account row and its menu, the archived Chat's (Grok's): at the
// bottom of the sidebar, a 40px row with the initials' avatar and the
// name (in the computer's rail, the avatar alone, named in a tooltip). It
// opens a menu above it (a sheet on a phone): the name and email, then
// Theme, which flips light and dark and stays open so its sun and moon
// spin, Feature tour, which adds the pinned demo chat (src/lib/chat/tour.ts)
// or refreshes it, and opens it, then Sign out, which lands on /sign-in. Agents ask before signing out
// (data-agent-confirm).
import { useEffect, useRef, useState } from "react"
import { useNavigate, useRouter } from "@tanstack/react-router"
import { CompassIcon, LogOutIcon } from "lucide-react"

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
import { authClient } from "@/lib/auth/client"
import { addTour } from "@/lib/chat/list"
import { restored } from "@/lib/reload-for-status-bar"

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
  onOpenChat,
  reopen = false,
}: {
  account: Account
  /** Named in a tooltip, for the rail, where the name is hidden. */
  tooltip?: boolean
  /** Feature tour opened its chat: the phone's drawer closes, as it does
   *  for a row. */
  onOpenChat?: () => void
  /** It was open before the status bar's reload (Theme keeps it open), so
   *  it starts open again (src/lib/reload-for-status-bar.ts). */
  reopen?: boolean
}) {
  // Read once: it's about the moment the menu appears. It opens from an
  // effect rather than defaultOpen, so onOpenChangeComplete says when it's
  // up.
  const reopening = useRef(reopen)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    // oxlint-disable-next-line react-hooks-js/set-state-in-effect -- opens once it's on the page, so its open completes
    if (reopening.current) setOpen(true)
  }, [])
  const navigate = useNavigate()
  const router = useRouter()
  const toggleTheme = useToggleTheme()
  async function signOut() {
    const { error } = await authClient.signOut()
    if (error) throw new Error(error.message ?? "Couldn't sign out")
    await navigate({ to: "/sign-in" })
  }
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
    <Menu
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(open) => {
        if (!open || !reopening.current) return
        reopening.current = false
        restored("menu")
      }}
    >
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
      <MenuContent side="top" data-account-menu>
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
  )
}
