// Settings › Appearance's accent color (src/lib/accent.ts): ui-sdk's
// ColorPicker holding the eight presets as a row of 28px swatches (a ring
// around the chosen one), then a rainbow + that opens the full picker
// for any other color: a saturation-and-brightness square, a hue slider
// and a hex box, in a Popover (a sheet on a phone). The app shows each
// step of a drag at once, in the readable pair the color becomes, and
// saves it in this browser once the drag, key or typed color ends. The
// choice follows the page across tabs.
import * as React from "react"
import { PlusIcon } from "lucide-react"
import {
  ColorPicker,
  ColorPickerArea,
  ColorPickerAreaThumb,
  ColorPickerInput,
  ColorPickerSlider,
  ColorPickerSliderThumb,
  ColorPickerSwatches,
  ColorPickerSwatchItem,
} from "@ui-sdk/react/color-picker"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@ui-sdk/react/popover"

import {
  accentColors,
  applyAccent,
  DEFAULT_ACCENT,
  PRESETS,
  saveAccent,
  savedAccent,
} from "@/lib/accent"
import { ACCENT_KEY } from "@/lib/theme"
import { cn } from "@/lib/utils"

/** The saved choice, kept in step with other tabs. */
function useSavedAccent() {
  const text = React.useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(ACCENT_KEY),
    () => null
  )
  return React.useMemo(() => savedAccent(text), [text])
}

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  const fromOtherTab = (event: StorageEvent) => {
    if (event.key !== ACCENT_KEY) return
    applyAccent(savedAccent(event.newValue))
    listener()
  }
  listeners.add(listener)
  window.addEventListener("storage", fromOtherTab)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", fromOtherTab)
  }
}

/** Saves `pick` and tells this tab's readers; other tabs hear the
 *  storage event. */
function save(pick: string) {
  saveAccent(pick)
  for (const listener of listeners) listener()
}

const presetPicks = new Set<string>(PRESETS.map((preset) => preset.light))

/** The ring the chosen swatch wears, 2px out from it. */
const chosen =
  "outline-hidden outline-offset-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background data-selected:outline-2 data-selected:outline-solid data-selected:outline-foreground"

function AccentPicker() {
  const saved = useSavedAccent()
  // A drag shows here at once and saves when it ends.
  const [dragging, setDragging] = React.useState<string | null>(null)
  const value = dragging ?? saved?.pick ?? DEFAULT_ACCENT
  const custom = !presetPicks.has(value)
  return (
    <ColorPicker
      aria-label="Accent color"
      format="hex"
      value={value}
      onValueChange={(next) => {
        setDragging(next)
        applyAccent(accentColors(next))
      }}
      onValueCommit={(next) => {
        save(next)
        setDragging(null)
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <ColorPickerSwatches
        aria-label="Presets"
        className="flex flex-wrap items-center gap-2"
      >
        {PRESETS.map((preset) => (
          <ColorPickerSwatchItem
            key={preset.light}
            value={preset.light}
            aria-label={preset.name}
            className={cn(
              "relative size-7 rounded-full bg-(--color-picker-color) after:absolute after:-inset-1",
              chosen
            )}
          />
        ))}
      </ColorPickerSwatches>
      <Popover presentation="auto">
        <PopoverTrigger
          aria-label="Custom color"
          data-selected={custom ? "" : undefined}
          className={cn(
            "relative flex size-7 items-center justify-center rounded-full text-white outline-hidden rainbow after:absolute after:-inset-1 focus-visible:ring-2 focus-visible:ring-ring",
            chosen
          )}
        >
          <PlusIcon aria-hidden className="size-4 drop-shadow-sm" />
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="end"
          sideOffset={8}
          className={cn(
            "flex flex-col gap-3 border border-border-strong bg-popover p-3 text-popover-foreground outline-hidden",
            "data-[presentation=popover]:w-72 data-[presentation=popover]:popup-motion data-[presentation=popover]:rounded-overlay data-[presentation=popover]:shadow-popover",
            "data-[presentation=sheet]:sheet-handle data-[presentation=sheet]:w-full data-[presentation=sheet]:rounded-t-overlay data-[presentation=sheet]:border-b-0 data-[presentation=sheet]:px-4 data-[presentation=sheet]:pt-2 data-[presentation=sheet]:safe-area-bottom data-[presentation=sheet]:sheet-bleed"
          )}
        >
          <PopoverTitle className="text-sm font-medium text-foreground">
            Custom color
          </PopoverTitle>
          <ColorPickerArea className="relative h-36 w-full touch-none rounded-xl bg-(image:--color-area-background)">
            <ColorPickerAreaThumb className={thumb} />
          </ColorPickerArea>
          <ColorPickerSlider
            channel="hue"
            className="relative h-3 w-full touch-none rounded-full rainbow-track"
          >
            <ColorPickerSliderThumb className={cn(thumb, "top-1/2")} />
          </ColorPickerSlider>
          <ColorPickerInput
            aria-label="Hex"
            spellCheck={false}
            autoComplete="off"
            className="h-9 w-full rounded-item border border-border-strong bg-transparent px-3 font-mono text-sm text-foreground outline-hidden focus:border-ring pointer-coarse:h-11 pointer-coarse:text-base"
          />
          <p className="text-xs text-muted-foreground">
            Made lighter or darker where needed, so it reads in light and dark.
          </p>
        </PopoverContent>
      </Popover>
    </ColorPicker>
  )
}

/** A thumb on the square or the slider: the color, ringed in white. */
const thumb =
  "size-5 -translate-1/2 rounded-full border-2 border-white bg-(--color-picker-color) shadow-popover focus-visible:ring-2 focus-visible:ring-ring outline-hidden"

export { AccentPicker }
