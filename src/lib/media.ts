// Media queries read in script, for what a part renders rather than how it
// looks (that's CSS's). null on the server and while hydrating, so a part
// can render the same as the server did first.
// - usePhone: the screen is a phone's, as Tailwind's `max-md`: the sidebar
//   is a drawer there and toasts drop from the top.
// - useStandalone: Chat runs as the installed Home Screen app, not in a
//   browser tab (display-mode: standalone, from the manifest).
import { useSyncExternalStore } from "react"

function useMediaQuery(media: string): boolean | null {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(media)
      query.addEventListener("change", onChange)
      return () => query.removeEventListener("change", onChange)
    },
    () => window.matchMedia(media).matches,
    () => null
  )
}

export const usePhone = () => useMediaQuery("(width < 48rem)")

export const useStandalone = () => useMediaQuery("(display-mode: standalone)")
