// The waiting marker: from sending until the reply's first word, one quiet
// line where the reply will start, so the screen never looks stuck. The
// archived Chat's: the spinner, "Thinking" with a soft shimmer, and the
// seconds so far once there's at least one.
import { useEffect, useState } from "react"

import { Spinner } from "@/components/ui/spinner"

export function PendingReply() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const id = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - start) / 1000)),
      1000
    )
    return () => window.clearInterval(id)
  }, [])
  return (
    <p
      role="status"
      className="flex min-h-6 items-center gap-2 text-sm text-muted-foreground"
    >
      <Spinner />
      <span className="shimmer">Thinking</span>
      {seconds > 0 && <span className="tabular-nums">{seconds}s</span>}
    </p>
  )
}
