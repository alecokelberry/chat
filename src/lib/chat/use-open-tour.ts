// Adds (or refreshes) the pinned feature tour chat and opens it, for the
// account menu's Feature tour and Search's: `onOpened` runs once it's open
// (the phone's drawer closes), and a failure shows a toast.
import { useNavigate, useRouter } from "@tanstack/react-router"

import { toast } from "@/components/ui/toast"
import { addTour } from "@/lib/chat/list"

export function useOpenTour(onOpened?: () => void) {
  const navigate = useNavigate()
  const router = useRouter()
  return async function openTour() {
    try {
      const id = await addTour()
      await router.invalidate()
      await navigate({ to: "/c/$id", params: { id } })
      onOpened?.()
    } catch {
      toast.error("Couldn't add the feature tour")
    }
  }
}
