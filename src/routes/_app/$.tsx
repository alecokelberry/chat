// Any address under the signed-in app that no other route claims: the
// not-found page, inside the shell (the signed-out are sent to sign-in first
// by src/routes/_app/route.tsx). It's the route's own page, not a thrown
// notFound(): TanStack Router would replace the whole layout with a
// notFoundComponent, shell and all.
import { createFileRoute } from "@tanstack/react-router"

import { NotFoundPage } from "@/components/error-page"

export const Route = createFileRoute("/_app/$")({
  component: NotFoundPage,
})
