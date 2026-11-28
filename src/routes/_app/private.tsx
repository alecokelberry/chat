// A private chat at /private (src/lib/chat/id.ts): a new chat's page with
// Private on, then, from the first send, the chat itself on the same page,
// on an agent that keeps nothing (src/lib/chat/agent.ts). Its id lives only
// in this page's memory, so leaving any way (New Chat, another chat, a
// reload) ends it for good: the socket closes and the agent wipes itself,
// and a reload opens a fresh one. Once sent, Private goes, so a chat can't
// switch halfway, and the header's pill says "Private chat" where a saved
// chat's title would be, over the dashed composer.
import { Suspense, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"

import {
  Chat,
  ChatHeaderBar,
  ChatPage,
  type FirstMessage,
} from "@/components/chat/chat"
import { NewChat } from "@/components/chat/new-chat"
import { HeaderTitle } from "@/components/ui/header-title"
import { handOffFiles } from "@/lib/chat/attachments"
import { newPrivateChatId } from "@/lib/chat/id"
import { pageTitle } from "@/lib/utils"

export const Route = createFileRoute("/_app/private")({
  head: () => ({ meta: [{ title: pageTitle("Private chat") }] }),
  component: PrivateChat,
})

function PrivateChat() {
  const [id] = useState(newPrivateChatId)
  const [first, setFirst] = useState<FirstMessage>()
  if (first === undefined)
    return (
      <NewChat
        isPrivate
        onSend={(text, files, model) => {
          handOffFiles(id, files)
          setFirst({ text, model, files: files.length })
        }}
      />
    )
  return (
    <ChatPage>
      <ChatHeaderBar>
        <HeaderTitle>Private chat</HeaderTitle>
      </ChatHeaderBar>
      <Suspense>
        <Chat id={id} firstMessage={first} isPrivate />
      </Suspense>
    </ChatPage>
  )
}
