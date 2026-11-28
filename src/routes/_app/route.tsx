// The signed-in app: Skip to content, then the chat list's sidebar beside
// the page (a new chat or a chat, whose <main> is #main). Only a signed-in
// browser gets here; anyone else goes to /sign-in. The list loads with the
// first page, again in the background on each navigation (a chat you left
// may have been named since), and at once when the open chat's agent says
// it changed (src/routes/_app/c.$id.tsx). ChatListProvider shares it with
// the sidebar and the chat's header, and shows a rename or pin at once.
// In dev, ?data=worst|empty|one swaps the chats and the account for made-up
// extremes (src/lib/dev/worst-case.ts), kept on every page by the search
// middleware, with a bar at the bottom to flip between them or leave.
import { useEffect, useMemo } from "react"
import {
  createFileRoute,
  Outlet,
  redirect,
  retainSearchParams,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"

import { ChatListProvider } from "@/components/chat/chat-list"
import { ChatSidebar } from "@/components/chat/chat-sidebar"
import { DemoBar } from "@/components/ui/demo-bar"
import { SkipLink } from "@/components/ui/skip-link"
import { getApp } from "@/lib/chat/list"
import {
  type DataState,
  parseDataState,
  previewAccount,
  previewChats,
  previewEnabled,
} from "@/lib/dev/worst-case"
import { whenIdle } from "@/lib/idle"
import { isSidebarCollapsed } from "@/lib/sidebar"

export const Route = createFileRoute("/_app")({
  validateSearch: (search: Record<string, unknown>): { data?: DataState } => ({
    data: parseDataState(search.data),
  }),
  search: { middlewares: [retainSearchParams(["data"])] },
  beforeLoad: async () => {
    // The account and the chat list in one call, so a navigation or a
    // refresh is one request. The loader only passes the list on.
    const app = await getApp()
    if (app === null) throw redirect({ to: "/sign-in" })
    return { ...app, sidebarCollapsed: isSidebarCollapsed() }
  },
  loader: ({ context }) => context.chats,
  component: AppLayout,
})

function AppLayout() {
  const loaded = Route.useLoaderData()
  const { user, sidebarCollapsed } = Route.useRouteContext()
  const { data } = Route.useSearch()
  const navigate = useNavigate()
  // The chat screen's code (and, through it, a reply's renderer) loads
  // while idle, so the first chat opened or started doesn't wait on it.
  const router = useRouter()
  useEffect(
    () =>
      whenIdle(
        () => void router.loadRouteChunk(router.routesById["/_app/c/$id"])
      ),
    [router]
  )
  const chats = useMemo(() => previewChats(loaded, data), [loaded, data])
  const setData = (state: typeof data) =>
    void navigate({ to: ".", search: (prev) => ({ ...prev, data: state }) })
  return (
    <ChatListProvider chats={chats}>
      <SkipLink />
      <ChatSidebar
        account={previewAccount(user, data)}
        customize={user.customize}
        collapsed={sidebarCollapsed}
      >
        <Outlet />
      </ChatSidebar>
      {previewEnabled && data !== undefined && (
        <DemoBar
          value={data}
          onChange={setData}
          onClose={() => setData(undefined)}
        />
      )}
    </ChatListProvider>
  )
}
