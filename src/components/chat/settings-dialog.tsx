// Settings' dialog: what the signed-in shell renders, and the controller
// that opens it (the account menu's Settings) at
// the section its payload names. The window inside
// (src/components/chat/settings.tsx) is its own chunk, so it stays out of
// a page's first load: it loads once the browser is idle, or on the spot
// if Settings opens first.
import { lazy, Suspense, useEffect } from "react"

import type { Account } from "@/components/chat/account-menu"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  createDialogController,
} from "@/components/ui/dialog"
import type { Customize } from "@/lib/ai/style"
import { whenIdle } from "@/lib/idle"
import { isSectionId, type SectionId } from "@/lib/settings/sections"

/** What opens Settings, at the section its payload names: one per
 *  signed-in shell. */
export const createSettingsController = () =>
  createDialogController<SectionId>()

export type SettingsController = ReturnType<typeof createSettingsController>

const load = () => import("@/components/chat/settings")
const Settings = lazy(() =>
  load().then(({ Settings }) => ({ default: Settings }))
)

export function SettingsDialog({
  controller,
  account,
  customize,
}: {
  controller: SettingsController
  account: Account
  /** The response style as last saved. */
  customize: Customize
}) {
  useEffect(() => whenIdle(() => void load()), [])
  return (
    <Dialog controller={controller}>
      <DialogContent wide>
        {(state) => (
          // While it loads, the dialog is named and empty.
          <Suspense
            fallback={<DialogTitle className="sr-only">Settings</DialogTitle>}
          >
            <Settings
              pages={{ account, customize }}
              first={isSectionId(state.payload) ? state.payload : "account"}
            />
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  )
}
