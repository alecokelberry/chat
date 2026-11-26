// The signed-in app: the chat list's sidebar beside the page (a new chat or
// a chat). Only a signed-in browser gets here; anyone else goes to
// /sign-in. The list loads with the first page, again in the background on
// each navigation (a chat you left may have been named since), and at once
// when the open chat's agent says it changed (src/routes/_app/c.$id.tsx).
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { ChatSidebar } from "@/components/chat/chat-sidebar"
import { getSession } from "@/lib/auth/session"
import { getChats } from "@/lib/chat/list"

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const user = await getSession()
    if (user === null) throw redirect({ to: "/sign-in" })
    return { user }
  },
  loader: () => getChats(),
  component: AppLayout,
})

function AppLayout() {
  const chats = Route.useLoaderData()
  return (
    <ChatSidebar chats={chats}>
      <Outlet />
    </ChatSidebar>
  )
}
