// The feature tour: one demo chat, pinned, that shows what Chat can do, in
// the exact shape real chats are saved in (a reply's parts and metadata as
// src/lib/chat/agent.ts and src/lib/ai/search.ts save them), so it renders
// like any chat. "Feature tour" in the account menu
// (components/chat/account-menu.tsx) puts it in the signed-in user's own
// list (src/lib/chat/list.ts): always the same chat id, so pressing it
// again refreshes this one chat, never adds a second, and touches no other
// chat. It deletes like any chat. When a big feature lands, add it here and
// press Feature tour again.
import type { UIMessage } from "ai"

import type { ModelKey } from "@/lib/ai/models"
import type { ReplyMetadata } from "@/lib/chat/reply-metadata"

/** The tour's chat id, the same for every user: a chat's key is the user
 *  and the id (src/lib/chat/store.ts), so each user has their own. */
export const TOUR_ID = "f3a70a2e-0000-4000-8000-000000000001"

export const TOUR_TITLE = "Feature tour (demo)"

const asked = (id: string, text: string, model: ModelKey): UIMessage => ({
  id: `tour-${id}`,
  role: "user",
  parts: [{ type: "text", text }],
  metadata: { model },
})

const replied = (
  id: string,
  parts: UIMessage["parts"],
  metadata: ReplyMetadata
): UIMessage => ({ id: `tour-${id}`, role: "assistant", parts, metadata })

const text = (words: string) => ({ type: "text" as const, text: words })

// When the tour was written: its replies' times count from here.
const WRITTEN = Date.UTC(2026, 10, 27, 12)

const WELCOME = `## Welcome to the feature tour

This is a **demo chat**, made to show what Chat can do. It isn't a real conversation, and you can delete it from its menu like any chat. *Feature tour* in your account menu brings it back, up to date.

Here's what's in it:

- **Markdown**: headings, lists, **bold**, *italics*, \`inline code\` and [links](https://developers.cloudflare.com/workers/).
- **Code** with a language label, Copy, and a fold for long blocks.
- **Tables** with Copy and Save as CSV.
- **Math**, inline and on its own line.
- **Thinking**: Ultra thinks before it answers, and you can open what it thought.
- **Web search**, with the sites it read under the reply.
- **Edit, Copy and Retry** on messages, and **rename, pin and delete** on chats.

This chat is **pinned**, so it stays at the top of your list. Scroll down for the rest.`

const LONG_CODE = `Here's a small TypeScript function. Blocks longer than 16 lines fold, so a long one doesn't fill the screen: press **Show more** to open it.

\`\`\`ts
type Reply = { model: string; ms: number }

/** How long each model took, on average, in seconds. */
export function averageTimes(replies: Reply[]): Map<string, number> {
  const totals = new Map<string, { ms: number; count: number }>()
  for (const { model, ms } of replies) {
    const total = totals.get(model) ?? { ms: 0, count: 0 }
    total.ms += ms
    total.count += 1
    totals.set(model, total)
  }
  const averages = new Map<string, number>()
  for (const [model, { ms, count }] of totals) {
    averages.set(model, Math.round(ms / count / 100) / 10)
  }
  return averages
}

console.log(averageTimes([{ model: "super", ms: 4200 }]))
\`\`\`

A short block stays open:

\`\`\`bash
pnpm check
\`\`\`

And a table. Hover it (or tap it on a phone) for Copy and Save as CSV:

| Model | Good for | Thinks |
| --- | --- | --- |
| Super | Everyday questions, and the default | No |
| Ultra | Hard problems that need reasoning | Yes |
| Nano Omni | Quick answers from a small model | No |
| Lightning | The fastest, and it names each chat | No |`

const REASONING =
  "They want to see math rendered. A good example is one everyone knows: the sum of the first n numbers, inline and as a display formula, plus the quadratic formula. I'll keep the words short so the math stands out."

const MATH = `Math renders inline, like $e^{i\\pi} + 1 = 0$, or on its own line:

$$
\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}
$$

$$
x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$

Dollar signs in plain text, like a $5 coffee, stay text. This reply came from **Ultra**, which thinks first: open **Thought for 6s** above to read what it thought.`

const SEARCH_QUERY = "Cloudflare Workers free plan limits"

const SEARCH = {
  type: "tool-webSearch" as const,
  toolCallId: "tour-search-1",
  state: "output-available" as const,
  input: { query: SEARCH_QUERY },
  output: {
    results: [
      {
        title: "Limits · Cloudflare Workers docs",
        url: "https://developers.cloudflare.com/workers/platform/limits/",
        site: "developers.cloudflare.com",
        snippet:
          "Workers Free: 100,000 requests a day, 10 ms of CPU time per request.",
      },
      {
        title: "Pricing · Cloudflare Workers docs",
        url: "https://developers.cloudflare.com/workers/platform/pricing/",
        site: "developers.cloudflare.com",
        snippet: "The Workers Free plan and what each paid plan adds.",
      },
      {
        title: "Cloudflare Workers",
        url: "https://workers.cloudflare.com/",
        site: "workers.cloudflare.com",
        snippet: "Build and deploy apps on Cloudflare's global network.",
      },
      {
        title: "Limits · Cloudflare D1 docs",
        url: "https://developers.cloudflare.com/d1/platform/limits/",
        site: "developers.cloudflare.com",
        snippet: "How much D1 holds and serves on the Free plan.",
      },
    ],
  },
}

const SEARCHED = `When a question needs current facts, Chat searches the web first. Open **Searched** above to see the query and every result; the sites it used sit under this reply.

On the Workers Free plan, which Chat runs on:

- **100,000 requests a day**, across the account.
- **10 ms of CPU** per request. Time spent waiting on a model doesn't count.
- A Worker of up to **3 MB**, compressed.`

/** A text file attached to a question (src/lib/chat/documents.ts). */
const PACKING_LIST = {
  type: "data-document" as const,
  data: {
    name: "zion-packing-list.md",
    mediaType: "text/plain",
    text: `# Zion, three days

- Water: 3 litres a day each
- Headlamp, spare batteries
- Permit for Angels Landing (printed)
- Layers: it's 2 °C at dawn and 18 °C by noon
- Trail snacks, sunscreen, a map that works offline`,
    cut: false,
  },
}

const PACKED = `You can attach files with the **+** in the composer, paste them, or drop them anywhere on the page: up to 4 a question, photos, PDFs and text files. Photos go to models that can see them (Super, Nano Omni); a PDF's or text file's words go to every model. Tap a photo above a question to see it full size.

Your list covers the essentials. Two things I'd add:

- **Microspikes** if you go before April: the upper trail can be icy.
- **A second water bottle** for the Narrows, where you'll want both hands free.`

const HOW_TO = `Every message has its actions:

- **Your questions**: *Edit* rewrites one and asks again from there (everything after it is replaced), and *Copy* copies it. Try Edit on any question above.
- **Replies**: *Copy*, and *Retry* on the last one asks the model again. Under each reply is who answered and how long it took.
- **While a reply streams**: *Stop* keeps what arrived.

And every chat has a menu (its row's **…** in the sidebar, or the **…** at the top of the chat): *Rename*, *Pin* or *Unpin*, and *Delete*, which offers Undo first.

Pick the model in the composer, and switch light and dark with *Theme* in your account menu. That's the tour. Ask anything to keep going in this chat, or start a new one.`

/** The tour's messages, oldest first. */
export const TOUR_MESSAGES: UIMessage[] = [
  asked("1", "What can this chat do? Show me the tour.", "super"),
  replied("2", [text(WELCOME)], {
    model: "super",
    started: WRITTEN,
    ms: 3_400,
  }),
  asked("3", "Show me some code and a table.", "super"),
  replied("4", [text(LONG_CODE)], {
    model: "super",
    started: WRITTEN + 60_000,
    ms: 5_100,
  }),
  asked("5", "Can it do math?", "ultra"),
  replied(
    "6",
    [{ type: "reasoning", text: REASONING, state: "done" }, text(MATH)],
    {
      model: "ultra",
      started: WRITTEN + 120_000,
      thinking: WRITTEN + 120_700,
      thought: 6_200,
      ms: 11_800,
    }
  ),
  asked("7", "What are the Cloudflare Workers free plan limits?", "super"),
  replied("8", [SEARCH, text(SEARCHED)], {
    model: "super",
    started: WRITTEN + 180_000,
    ms: 7_600,
  }),
  {
    ...asked("9", "Anything missing from my packing list?", "super"),
    parts: [PACKING_LIST, text("Anything missing from my packing list?")],
  },
  replied("10", [text(PACKED)], {
    model: "super",
    started: WRITTEN + 240_000,
    ms: 5_200,
  }),
  asked("11", "How do I edit, retry or delete things?", "super"),
  replied("12", [text(HOW_TO)], {
    model: "super",
    started: WRITTEN + 300_000,
    ms: 4_300,
  }),
]
