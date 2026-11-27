// A reply's sources: one small outline button under the reply, "5 sources"
// (Alec's pick over a row of site pills, Nov 27: it stays one line however
// many sites a reply found). It opens a Menu (a sheet on a phone) listing
// each site once, its page title over its site name. Each row is a plain
// link that opens the page in a new tab without telling the site where the
// visit came from (rel="noopener noreferrer"). No site icons: loading them
// would tell each site what the chat read, and the CSP blocks images from
// other sites anyway (src/start.ts).
import { GlobeIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuTrigger,
} from "@/components/ui/menu"
import type { Source } from "@/lib/chat/searches"

export function Sources({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null
  const label = `${sources.length} ${sources.length === 1 ? "source" : "sources"}`
  return (
    <Menu>
      <MenuTrigger
        render={<Button variant="outline" size="sm" className="self-start" />}
      >
        <GlobeIcon data-icon="inline-start" aria-hidden />
        {label}
      </MenuTrigger>
      <MenuContent>
        <MenuGroup>
          <MenuGroupLabel>Sources</MenuGroupLabel>
          {sources.map((source) => (
            <MenuItem
              key={source.site}
              render={
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${source.title}, ${source.site}`}
                />
              }
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{source.title}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {source.site}
                </span>
              </span>
            </MenuItem>
          ))}
        </MenuGroup>
      </MenuContent>
    </Menu>
  )
}
