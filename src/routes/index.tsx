// Home: a placeholder until chat lands (docs/plan.md). Only a signed-in
// browser gets here; anyone else goes to /sign-in.
import { createFileRoute, redirect } from "@tanstack/react-router"

import { getSession } from "@/lib/auth/session"

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const user = await getSession()
    if (user === null) throw redirect({ to: "/sign-in" })
    return { user }
  },
  component: Home,
})

function Home() {
  const { user } = Route.useRouteContext()
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-4 text-foreground">
      <h1 className="text-3xl font-medium">Hi, {user.name}</h1>
    </main>
  )
}
