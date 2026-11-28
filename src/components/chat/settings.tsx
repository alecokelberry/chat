// Settings: one window for the account's settings, opened by the account
// menu's Settings through a controller whose payload names the section to
// open at.
// A dialog with the nav on the left on a computer (ui-sdk Tabs, vertical),
// a sheet on a touch phone, where the sections come first and a tap
// slides to one, with Back at its top. The search box at the top of the
// nav keeps the sections whose name or settings hold what's typed
// (src/lib/settings/sections.ts), and the first of them shows; with none,
// it says so. Each section's page is its own component below: Account
// (who's signed in, Sign Out), Appearance (the theme, the accent color, code wrapping) and
// Customize (the response style, src/lib/ai/style.ts) and Usage (each
// model's share of the tokens used, all time: src/lib/chat/usage.ts). The
// look is src/components/ui/settings.tsx and src/components/ui/usage.tsx.
// It loads on its own, after first load, through the dialog in
// src/components/chat/settings-dialog.tsx.
import { useEffect, useEffectEvent, useRef, useState } from "react"
import { useRouter } from "@tanstack/react-router"
import {
  ChartNoAxesColumnIcon,
  CircleUserRoundIcon,
  ContrastIcon,
  SlidersHorizontalIcon,
} from "lucide-react"

import type { Account } from "@/components/chat/account-menu"
import { AccentPicker } from "@/components/ui/accent-picker"
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
import {
  SHARE_INSIDE_MIN,
  UsageBar,
  UsageLegend,
  UsageLegendItem,
  UsageSummary,
  UsageTotal,
} from "@/components/ui/usage"
import { toast } from "@/components/ui/toast"
import {
  CUSTOM_MAX,
  RESPONSE_STYLES,
  STYLE_NAMES,
  type Customize,
  type ResponseStyle,
} from "@/lib/ai/style"
import { authClient } from "@/lib/auth/client"
import { getCustomizeNow } from "@/lib/auth/session"
import { SIGN_OUT_CONFIRM, useSignOut } from "@/lib/auth/use-sign-out"
import { getUsage } from "@/lib/chat/list"
import { initialsOf } from "@/lib/settings/initials"
import {
  findSections,
  isSectionId,
  type SectionId,
} from "@/lib/settings/sections"
import type { UsageSplit } from "@/lib/settings/usage-split"

const ICONS: Record<SectionId, React.ReactNode> = {
  account: <CircleUserRoundIcon aria-hidden />,
  appearance: <ContrastIcon aria-hidden />,
  customize: <SlidersHorizontalIcon aria-hidden />,
  usage: <ChartNoAxesColumnIcon aria-hidden />,
}

/** What a section's page may need. */
export type PageProps = { account: Account; customize: Customize }

/** Each section's page. */
const PAGES: Record<SectionId, (props: PageProps) => React.ReactNode> = {
  account: ({ account }) => <AccountPage account={account} />,
  appearance: () => <AppearancePage />,
  customize: ({ customize }) => <CustomizePage saved={customize} />,
  usage: () => <UsagePage />,
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
    <SettingsCard>
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
          data-agent-confirm={SIGN_OUT_CONFIRM}
          onClick={signOut}
        >
          Sign Out
        </Button>
      </SettingsRow>
    </SettingsCard>
  )
}

/** The theme, with the same sun-and-moon button the sign-in page has (the
 *  account menu's Theme does the same), the accent color, and whether
 *  code wraps. */
function AppearancePage() {
  const [wrap, setWrap] = useCodeWrap()
  return (
    <SettingsCard>
      <SettingsRow name="Theme" description="Switch light and dark">
        <ThemeToggle />
      </SettingsRow>
      <SettingsRow
        name="Accent color"
        description="Send button, New Chat and selection"
        className="flex-col items-stretch"
      >
        <AccentPicker />
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

/** How long Custom's text rests before it's saved. */
const SAVE_AFTER_MS = 600

/** The response style, and Custom's own words, saved to the account as
 *  they change (a pick at once, the words once typing rests, or as the box
 *  loses focus or Settings closes), so every device's next message follows
 *  them. It opens with what D1 holds now, since the session it starts from
 *  may be a few minutes old. A failed save says so and goes back to what's
 *  saved: the style shows it again, and the words try again on the next
 *  rest, blur or close. */
function CustomizePage({ saved }: { saved: Customize }) {
  const router = useRouter()
  const [style, setStyle] = useState<ResponseStyle>(saved.style)
  const [custom, setCustom] = useState(saved.custom)
  // What the account holds, as last read or sent.
  const stored = useRef(saved)
  // The words as typed, for a save when Settings closes.
  const typed = useRef(saved.custom)
  // Whether a change was made here, which a late fresh read mustn't undo.
  const touched = useRef(false)

  useEffect(() => {
    let open = true
    getCustomizeNow()
      .then((now) => {
        if (!open || now === null || touched.current) return
        stored.current = now
        typed.current = now.custom
        setStyle(now.style)
        setCustom(now.custom)
      })
      // Keeps the session's copy, which is only a few minutes old.
      .catch(() => undefined)
    return () => {
      open = false
    }
  }, [])

  async function save(fields: Partial<Customize>) {
    const before = stored.current
    stored.current = { ...before, ...fields }
    const saved = await authClient
      .updateUser({
        responseStyle: fields.style,
        customInstructions: fields.custom,
      })
      .then(({ error }) => error === null)
      // A network failure rejects instead.
      .catch(() => false)
    if (!saved) {
      toast.error("Couldn't save your response style")
      if (fields.style !== undefined) {
        stored.current = { ...stored.current, style: before.style }
        setStyle(before.style)
      }
      if (fields.custom !== undefined) {
        stored.current = { ...stored.current, custom: before.custom }
      }
      return
    }
    // The layout's copy (the session) follows, for the next open.
    void router.invalidate()
  }

  function saveTyped() {
    if (typed.current === stored.current.custom) return
    void save({ custom: typed.current })
  }
  const saveTypedLater = useEffectEvent(saveTyped)

  // Once typing rests.
  useEffect(() => {
    const timer = setTimeout(saveTypedLater, SAVE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [custom])

  // When Settings closes mid-rest.
  useEffect(() => () => saveTypedLater(), [])

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
            touched.current = true
            setStyle(next)
            void save({ style: next })
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
            onValueChange={(value) => {
              touched.current = true
              typed.current = value
              setCustom(value)
            }}
            onBlur={saveTyped}
          />
        </SettingsField>
      )}
    </SettingsCard>
  )
}

/** Whole numbers in the reader's own style: 12,345. */
const whole = (value: number) => value.toLocaleString()

/** A big number, short: 12,345 below ten thousand, then 48.2K, 1.3M. */
const short = (value: number) =>
  value < 10_000
    ? whole(value)
    : value.toLocaleString(undefined, {
        notation: "compact",
        maximumFractionDigits: 1,
      })

/** A share: 12%, or under 1% for one that rounds to none. */
const percent = (value: number) => (value === 0 ? "under 1%" : `${value}%`)

const plural = (value: number, one: string, many: string) =>
  `${whole(value)} ${value === 1 ? one : many}`

/** Each model's share of the tokens used, all time, read as the page
 *  opens: the total, the bar, and a legend row per model used. */
function UsagePage() {
  // undefined while it loads, null if it couldn't.
  const [usage, setUsage] = useState<UsageSplit | null | undefined>()
  useEffect(() => {
    let current = true
    getUsage().then(
      (split) => {
        if (current) setUsage(split)
      },
      () => {
        if (current) setUsage(null)
      }
    )
    return () => {
      current = false
    }
  }, [])

  const parts = usage?.parts ?? []
  const named = parts.map((part) => `${part.name} ${part.percent}%`).join(", ")
  return (
    <SettingsCard label="All time" aria-busy={usage === undefined}>
      <UsageSummary>
        <UsageTotal
          value={usage ? short(usage.tokens) : "–"}
          unit="tokens"
          detail={
            usage === null
              ? "Couldn't load your usage"
              : usage === undefined
                ? "Loading…"
                : usage.replies === 0
                  ? "Your models' share shows here after your first reply"
                  : `${plural(usage.replies, "reply", "replies")} across your chats`
          }
        />
        <UsageBar
          parts={parts.map((part) => ({ ...part, amount: part.tokens }))}
          aria-label={
            parts.length === 0
              ? "No tokens used yet"
              : `Tokens by model: ${named}`
          }
        />
      </UsageSummary>
      {parts.length > 0 && (
        <UsageLegend aria-label="Tokens by model">
          {parts.map((part) => (
            <UsageLegendItem
              key={part.key}
              series={part.slot}
              name={part.name}
              share={
                part.percent < SHARE_INSIDE_MIN
                  ? percent(part.percent)
                  : undefined
              }
              detail={plural(part.replies, "reply", "replies")}
              value={plural(part.tokens, "token", "tokens")}
            />
          ))}
        </UsageLegend>
      )}
    </SettingsCard>
  )
}
