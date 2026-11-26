// EditActions: ✕ and ✓ at the end of a field being edited (a chat's
// rename), the archived Chat's: ghost 24px buttons 2px apart, each named
// in a tooltip. Pressing one keeps focus in the field (its mousedown is
// cancelled), so the field's blur doesn't end the edit first.
import { CheckIcon, XIcon } from "lucide-react"
import type * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

function EditAction({
  label,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="edit"
            aria-label={label}
            onMouseDown={(event) => event.preventDefault()}
            {...props}
          />
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function EditActions({
  onCancel,
  onSave,
}: {
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <span
      data-slot="edit-actions"
      className="flex shrink-0 items-center gap-0.5"
    >
      <EditAction label="Cancel" onClick={onCancel}>
        <XIcon aria-hidden />
      </EditAction>
      <EditAction label="Save" onClick={onSave}>
        <CheckIcon aria-hidden />
      </EditAction>
    </span>
  )
}

export { EditActions }
