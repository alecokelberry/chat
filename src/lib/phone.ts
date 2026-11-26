// Whether the screen is a phone's, as Tailwind's `max-md`: the sidebar is a
// drawer there and toasts drop from the top. null on the server and while
// hydrating, so a part can render the same as the server did first.
import { useSyncExternalStore } from "react"

const PHONE = "(width < 48rem)"

function subscribe(onChange: () => void) {
  const query = window.matchMedia(PHONE)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

export function usePhone(): boolean | null {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE).matches,
    () => null
  )
}
