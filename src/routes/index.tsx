// Home: a placeholder until sign-in and chat land (docs/plan.md).
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({ component: Home })

function Home() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-4 text-foreground">
      <h1 className="text-3xl font-medium">Chat</h1>
    </main>
  )
}
