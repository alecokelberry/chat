// The sidebar's chats: a server function, so the signed-in pages' layout
// (src/routes/_app/route.tsx) loads them on the server on first load and
// asks again on client navigation or when the open chat says the list
// changed.
import { env } from "cloudflare:workers"
import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"

import { getAuth } from "@/lib/auth/server"
import { listChats } from "@/lib/chat/store"

export const getChats = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getAuth().api.getSession({
    headers: getRequest().headers,
  })
  return session === null ? [] : listChats(env.DB, session.user.id)
})
