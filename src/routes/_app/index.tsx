// New chat at /: the page (src/components/chat/new-chat.tsx), whose first
// send makes the chat: a fresh id, then /c/<id> with the message and its
// model in history state (its files go ahead in memory,
// src/lib/chat/attachments.ts), which that page sends once it's connected
// (src/routes/_app/c.$id.tsx).
import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { NewChat } from "@/components/chat/new-chat"
import { handOffFiles } from "@/lib/chat/attachments"
import { pageTitle } from "@/lib/utils"

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: pageTitle("New chat") }] }),
  component: SavedNewChat,
})

function SavedNewChat() {
  const navigate = useNavigate()
  return (
    <NewChat
      isPrivate={false}
      onSend={(text, files, model) => {
        const id = crypto.randomUUID()
        handOffFiles(id, files)
        void navigate({
          to: "/c/$id",
          params: { id },
          state: { firstMessage: { text, model, files: files.length } },
        })
      }}
    />
  )
}
