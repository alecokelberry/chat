// Settings: one window for the account's settings, opened by the account
// menu's Settings through a controller whose payload names the section to
// open at.
// A dialog with the nav on the left on a computer (ui-sdk Tabs, vertical),
// a sheet on a touch phone, where the sections come first and a tap
// slides to one, with Back at its top. The search box at the top of the
// nav keeps the sections whose name or settings hold what's typed
// (src/lib/settings/sections.ts), and the first of them shows; with none,
// it says so. Each section's page is its own component below: Account
// (who's signed in, Sign Out), Appearance (the theme, code wrapping) and
// Customize (the response style, src/lib/ai/style.ts). The look is
// src/components/ui/settings.tsx. It loads on its own, after first load,
// through the dialog in src/components/chat/settings-dialog.tsx.
import { useEffect, useRef, useState } from "react"
import { useRouter } from "@tanstack/react-router"
import {
  CircleUserRoundIcon,
  ContrastIcon,
  SlidersHorizontalIcon,
} from "lucide-react"

import type { Account } from "@/components/chat/account-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useCodeWrap } from "@/components/ui/preferences"
import { Switch } from "@/components/ui/switch"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { DialogTitle } from "@/components/ui/dialog"
import {
  SettingsCard,
  SettingsField,
  SettingsLayout,
  SettingsNav,
  SettingsNavEmpty,
  SettingsNavItem,
  SettingsNavList,
  SettingsPage,
  SettingsRow,
  SettingsSearch,
} from "@/components/ui/settings"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import {
  CUSTOM_MAX,
  RESPONSE_STYLES,
  isResponseStyle,
  type Customize,
  type ResponseStyle,
} from "@/lib/ai/style"
import { authClient } from "@/lib/auth/client"
import { useSignOut } from "@/lib/auth/use-sign-out"
import { initialsOf } from "@/lib/settings/initials"
import {
  findSections,
  isSectionId,
  type SectionId,
} from "@/lib/settings/sections"

const ICONS: Record<SectionId, React.ReactNode> = {
  account: <CircleUserRoundIcon aria-hidden />,
  appearance: <ContrastIcon aria-hidden />,
  customize: <SlidersHorizontalIcon aria-hidden />,
}

/** What a section's page may need. */
export type PageProps = { account: Account; customize: Customize }

/** Each section's page. */
const PAGES: Record<SectionId, (props: PageProps) => React.ReactNode> = {
  account: ({ account }) => <AccountPage account={account} />,
  appearance: () => <AppearancePage />,
  customize: ({ customize }) => <CustomizePage saved={customize} />,
}

/** The nav and the page. It mounts each time Settings opens, so the
 *  search starts empty and the page is the one asked for. */
export function Settings({
  pages,
  first,
}: {
  pages: PageProps
  first: SectionId
}) {
  const [query, setQuery] = useState("")
  // With a mouse, typing searches at once. The dialog may have opened
  // before this loaded, when its own first focus found nothing to land on.
  const search = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (matchMedia("(pointer: fine)").matches) search.current?.focus()
  }, [])
  const [chosen, setChosen] = useState<SectionId>(first)
  // On a phone: whether a section's page shows instead of the nav.
  const [page, setPage] = useState(false)
  const found = findSections(query)
  // A section the search hides gives way to the first that's left.
  const ids = found.map((section) => section.id)
  const shown = ids.includes(chosen) ? chosen : ids[0]
  return (
    <>
      <DialogTitle className="sr-only">Settings</DialogTitle>
      <SettingsLayout
        page={page}
        value={shown ?? null}
        onValueChange={(value) => {
          if (isSectionId(value)) setChosen(value)
        }}
      >
        <SettingsNav>
          <SettingsSearch
            ref={search}
            aria-label="Search settings"
            placeholder="Search"
            value={query}
            onValueChange={(value) => setQuery(value)}
          />
          {found.length === 0 && (
            <SettingsNavEmpty>No settings found</SettingsNavEmpty>
          )}
          <SettingsNavList aria-label="Settings">
            {found.map((section) => (
              <SettingsNavItem
                key={section.id}
                value={section.id}
                icon={ICONS[section.id]}
                onClick={() => setPage(true)}
              >
                {section.label}
              </SettingsNavItem>
            ))}
          </SettingsNavList>
        </SettingsNav>
        {found.map((section) => (
          <SettingsPage
            key={section.id}
            value={section.id}
            title={section.label}
            onBack={() => setPage(false)}
          >
            {PAGES[section.id](pages)}
          </SettingsPage>
        ))}
      </SettingsLayout>
    </>
  )
}

/** Who's signed in, and Sign Out. */
function AccountPage({ account }: { account: Account }) {
  const signOut = useSignOut()
  return (
    <SettingsCard label="Account">
      <SettingsRow
        leading={
          <Avatar>
            <AvatarFallback>{initialsOf(account.name)}</AvatarFallback>
          </Avatar>
        }
        name={account.name}
        description={account.email}
      >
        <Button
          variant="outline"
          size="sm"
          data-agent-confirm="Signs you out on this device"
          onClick={signOut}
        >
          Sign Out
        </Button>
      </SettingsRow>
    </SettingsCard>
  )
}

/** The theme, with the same sun-and-moon button the sign-in page has (the
 *  account menu's Theme does the same), and whether code wraps. */
function AppearancePage() {
  const [wrap, setWrap] = useCodeWrap()
  return (
    <SettingsCard label="Appearance">
      <SettingsRow name="Theme" description="Switch light and dark">
        <ThemeToggle />
      </SettingsRow>
      <SettingsField
        name="Wrap long code blocks"
        description="Wrap long lines instead of scrolling sideways"
      >
        <Switch checked={wrap} onCheckedChange={setWrap} />
      </SettingsField>
    </SettingsCard>
  )
}

const STYLE_NAMES: Record<ResponseStyle, string> = {
  default: "Default",
  custom: "Custom",
  concise: "Concise",
  formal: "Formal",
  tutor: "Tutor",
  comprehensive: "Comprehensive",
}

/** How long Custom's text rests before it's saved. */
const SAVE_AFTER_MS = 600

/** The response style, and Custom's own words, saved to the account as
 *  they change (a pick at once, the words once typing rests), so every
 *  device's next message follows them. A failed save says so. */
function CustomizePage({ saved }: { saved: Customize }) {
  const router = useRouter()
  const [style, setStyle] = useState<ResponseStyle>(
    isResponseStyle(saved.style) ? saved.style : "default"
  )
  const [custom, setCustom] = useState(saved.custom)
  const stored = useRef(saved.custom)

  async function save(fields: {
    responseStyle?: ResponseStyle
    customInstructions?: string
  }) {
    const { error } = await authClient.updateUser(fields)
    if (error) {
      toast.error("Couldn't save your response style")
      return
    }
    // The layout's copy (the session) follows, for the next open.
    void router.invalidate()
  }

  useEffect(() => {
    if (custom === stored.current) return
    const timer = setTimeout(() => {
      stored.current = custom
      void save({ customInstructions: custom })
    }, SAVE_AFTER_MS)
    return () => clearTimeout(timer)
  })

  return (
    <SettingsCard>
      <SettingsRow
        name="Customize Chat's response"
        description="Personalize how Chat responds to you"
      >
        <Select<ResponseStyle>
          value={style}
          onValueChange={(next) => {
            if (next === null) return
            setStyle(next)
            void save({ responseStyle: next })
          }}
        >
          <SelectTrigger
            outline
            aria-label={`Response style: ${STYLE_NAMES[style]}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RESPONSE_STYLES.map((option) => (
              <SelectItem
                key={option}
                value={option}
                label={STYLE_NAMES[option]}
              >
                {STYLE_NAMES[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>
      {style === "custom" && (
        <SettingsField
          stacked
          name="Custom instructions"
          description={
            custom.length > CUSTOM_MAX - 200
              ? `${custom.length.toLocaleString()} of ${CUSTOM_MAX.toLocaleString()} characters`
              : "How Chat should answer: tone, length, format, anything"
          }
        >
          <Textarea
            variant="box"
            maxLength={CUSTOM_MAX}
            placeholder="Answer in British English, and keep code in TypeScript…"
            value={custom}
            onValueChange={(value) => setCustom(value)}
            onBlur={() => {
              if (custom === stored.current) return
              stored.current = custom
              void save({ customInstructions: custom })
            }}
          />
        </SettingsField>
      )}
    </SettingsCard>
  )
}
