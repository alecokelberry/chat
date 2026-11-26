// An even reveal for a streaming reply, in the browser. NVIDIA sends text
// in bursts (and proxies re-buffer even a smoothed stream), so this paces
// what the reply shows: the backlog drains over about CATCH_UP_MS, never
// slower than MIN_CHARS_PER_SECOND, whole words at a time. Text that's
// already there when the reply mounts (a saved chat, a reload) shows at
// once; text that streams in is paced, and keeps pacing after the stream
// ends until it has caught up, unless the reply was stopped: then what
// arrived shows at once. Ported from the archived Chat's lib/smooth-text.ts.
//
// A frame loop moves the position, but React renders only when the shown
// text reaches a new word, so a long reply re-renders once a word, not
// once a frame.
import { useEffect, useRef, useState } from "react"

const CATCH_UP_MS = 250
const MIN_CHARS_PER_SECOND = 160
/** A word longer than this appears in pieces rather than waiting. */
const MAX_WORD = 24

/** The reveal position after `elapsedMs`, given the text length so far. */
export function advanceReveal(
  position: number,
  length: number,
  elapsedMs: number
): number {
  const backlog = length - position
  if (backlog <= 0) return length
  const step = Math.max(
    (backlog * elapsedMs) / CATCH_UP_MS,
    (MIN_CHARS_PER_SECOND * elapsedMs) / 1000
  )
  return Math.min(length, position + step)
}

/** `text` up to `position`, extended to the end of the word it lands in. */
export function revealedText(text: string, position: number): string {
  return text.slice(0, revealedEnd(text, position))
}

/** Where `revealedText` ends: at the next space, or the end of the text
 *  if its last word is in reach. */
function revealedEnd(text: string, position: number): number {
  const end = Math.floor(position)
  if (end >= text.length) return text.length
  if (end <= 0) return 0
  const rest = text.slice(end, end + MAX_WORD + 1)
  const space = rest.search(/\s/)
  if (space !== -1) return end + space
  return rest.length <= MAX_WORD ? text.length : end
}

/**
 * The part of `text` to show now, and whether it has all shown.
 * `streaming`: still arriving. `stopped`: cut off by Stop, so show what
 * arrived.
 */
export function useSmoothText(
  text: string,
  { streaming, stopped }: { streaming: boolean; stopped: boolean }
) {
  const [position, setPosition] = useState(() => (streaming ? 0 : text.length))
  const positionRef = useRef(position)

  useEffect(() => {
    if (stopped || positionRef.current >= text.length) {
      positionRef.current = text.length
      return
    }
    let frame = 0
    let last = performance.now()
    let shown = revealedEnd(text, positionRef.current)
    const tick = (now: number) => {
      positionRef.current = advanceReveal(
        positionRef.current,
        text.length,
        now - last
      )
      last = now
      const next = revealedEnd(text, positionRef.current)
      if (next !== shown || positionRef.current >= text.length) {
        shown = next
        setPosition(positionRef.current)
      }
      if (positionRef.current < text.length) {
        frame = requestAnimationFrame(tick)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [text, stopped])

  const done = stopped || position >= text.length
  return { text: done ? text : revealedText(text, position), done }
}
