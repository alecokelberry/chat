// The dev-only bar for ?data= (src/lib/dev/worst-case.ts): fixed at the
// bottom centre of the screen, above the composer, it names the data on and flips between the
// states in a ui-sdk SegmentedControl; ✕ goes back to the real data. Plain
// on purpose: it's chrome, not part of the design under test, and sits
// above the composer and the toasts. Only the signed-in layout renders it,
// and only while a state is on (src/routes/_app/route.tsx).
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control"
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

function DemoBar<T extends string>({
  states,
  value,
  onChange,
  onClose,
}: {
  states: readonly T[]
  value: T
  onChange: (state: T) => void
  onClose: () => void
}) {
  return (
    <div
      data-slot="demo-bar"
      className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border-strong bg-popover p-1 text-sm shadow-tooltip"
    >
      <SegmentedControl
        aria-label="Preview data"
        value={value}
        onValueChange={(next) => {
          const state = states.find((s) => s === next)
          if (state !== undefined) onChange(state)
        }}
        className="relative isolate flex items-center"
      >
        <SegmentedControlIndicator className="absolute top-(--segmented-control-indicator-top) left-(--segmented-control-indicator-left) -z-10 h-(--segmented-control-indicator-height) w-(--segmented-control-indicator-width) rounded-full bg-secondary-hover" />
        {states.map((state) => (
          <SegmentedControlItem
            key={state}
            value={state}
            className="rounded-full px-3 py-1 capitalize outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            {state}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      <Button size="edit" aria-label="Back to the real data" onClick={onClose}>
        <XIcon aria-hidden />
      </Button>
    </div>
  )
}

export { DemoBar }
