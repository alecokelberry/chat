// A new chat's page, for / and, with Private on, /private: a greeting and
// the composer, centered in the space under the header, beside the sidebar
// (src/routes/_app/route.tsx, which also checks the session). Three
// starters sit under the composer: a tap fills it
// (src/lib/chat/starters.ts), and they go once there's anything to send.
// Private, at the top right as on Grok, flips between / and /private; on
// /private the composer's border is dashed and, in the starters' place, a
// line says the chat won't be kept. The page owns what a send does
// (onSend): / starts a saved chat, /private a private one.
import { useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { CircleDashedIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PillToggle } from "@/components/ui/pill-toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Composer, type ComposerHandle } from "@/components/chat/composer"
import { DEFAULT_MODEL, type ModelKey } from "@/lib/ai/models"
import type { AttachmentPart } from "@/lib/chat/attachments"
import { STARTERS } from "@/lib/chat/starters"

export function NewChat({
  isPrivate,
  onSend,
}: {
  /** Private's on: the toggle pressed, the border dashed, the note shown. */
  isPrivate: boolean
  onSend: (text: string, files: AttachmentPart[], model: ModelKey) => void
}) {
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [started, setStarted] = useState(false)
  const composer = useRef<ComposerHandle>(null)
  return (
    // The one-line composer (h-14.5, its 58px) sits at the exact middle of
    // the space under the header: a 1fr / auto / 1fr grid, with the greeting
    // ending the top row, 28px above it. The padding's room (the notch, the
    // home indicator) is each outer row's minimum instead, so it can't pull
    // the middle off. The composer grows downward out of its slot, so the
    // greeting stays put while you type; the page scrolls if they stop
    // fitting. 24px in on a phone.
    <main
      id="main"
      tabIndex={-1}
      className="grid min-h-0 flex-1 grid-rows-centered overflow-y-auto py-0 safe-area outline-hidden"
    >
      <PrivateToggle pressed={isPrivate} />
      <h1 className="self-end px-4 pb-7 text-center text-3xl font-medium">
        What can I help with?
      </h1>
      <div className="mx-auto h-14.5 w-full max-w-composer px-2 sm:px-0">
        <Composer
          ref={composer}
          onDraft={setStarted}
          model={model}
          onModelChange={setModel}
          isPrivate={isPrivate}
          onSend={(text, files) => onSend(text, files, model)}
        />
      </div>
      {/* Under the composer, starting where the middle row ends, so the
          composer stays at the exact middle. Gone once there's a draft or
          a file: the composer grows down over this space, and Grok's
          suggestions leave then too. */}
      {isPrivate ? (
        <p className="mx-auto mt-3 flex w-full max-w-composer items-center justify-center gap-1.5 self-start px-4 text-center text-sm text-muted-foreground">
          <CircleDashedIcon aria-hidden className="size-3.5 shrink-0" />
          This chat won’t appear in your history.
        </p>
      ) : (
        !started && (
          <ul
            aria-label="Starters"
            className="mx-auto mt-3 w-full max-w-composer self-start px-2 sm:px-0"
          >
            {STARTERS.map(({ icon: Icon, text }) => (
              <li key={text}>
                <Button
                  variant="starter"
                  size="none"
                  onClick={() => composer.current?.fill(text)}
                >
                  <Icon data-icon="inline-start" aria-hidden />
                  {text}
                </Button>
              </li>
            ))}
          </ul>
        )
      )}
    </main>
  )
}

/** Private, at the top right: a ui-sdk Toggle, pressed on /private. Its
 *  tooltip ("Private chat") names it (type "label", so it isn't heard
 *  twice): the name holds its word and stays the same either way, as
 *  ui-sdk asks, so a screen reader announces the pressed state. On a phone
 *  it shares the header row with the sidebar button. */
function PrivateToggle({ pressed }: { pressed: boolean }) {
  const navigate = useNavigate()
  // Pressed at once, as ui-sdk asks, not only once the other page is in:
  // each page mounts its own toggle, so this starts from the page's state.
  const [on, setOn] = useState(pressed)
  return (
    <div className="absolute end-4 top-0 z-10 box-content flex h-header items-center pt-safe">
      <Tooltip type="label">
        <TooltipTrigger
          render={
            <PillToggle
              pressed={on}
              onPressedChange={(next) => {
                setOn(next)
                void navigate({ to: next ? "/private" : "/" })
              }}
            />
          }
        >
          <CircleDashedIcon aria-hidden />
          Private
        </TooltipTrigger>
        <TooltipContent side="bottom">Private chat</TooltipContent>
      </Tooltip>
    </div>
  )
}
