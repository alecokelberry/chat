// The signed-in app: Skip to content, then the chat list's sidebar beside
// the page (a new chat or a chat, whose <main> is #main). Only a signed-in
// browser gets here; anyone else goes to /sign-in. The list loads with the
// first page, again in the background on each navigation (a chat you left
// may have been named since), and at once when the open chat's agent says
// it changed (src/routes/_app/c.$id.tsx). ChatListProvider shares it with
// the sidebar and the chat's header, and shows a rename or pin at once.
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { ChatListProvider } from "@/components/chat/chat-list"
import { ChatSidebar } from "@/components/chat/chat-sidebar"
import { SkipLink } from "@/components/ui/skip-link"
import { getSession } from "@/lib/auth/session"
import { getChats } from "@/lib/chat/list"
import { isSidebarCollapsed } from "@/lib/sidebar"

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const user = await getSession()
    if (user === null) throw redirect({ to: "/sign-in" })
    return { user, sidebarCollapsed: isSidebarCollapsed() }
  },
  loader: () => getChats(),
  component: AppLayout,
})

function AppLayout() {
  const chats = Route.useLoaderData()
  const { user, sidebarCollapsed } = Route.useRouteContext()
  return (
    <ChatListProvider chats={chats}>
      <SkipLink />
      <ChatSidebar account={user} collapsed={sidebarCollapsed}>
        <Outlet />
      </ChatSidebar>
    </ChatListProvider>
  )
}
