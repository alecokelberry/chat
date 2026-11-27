// A reply's sources: each site its web searches found, once, as a row of
// small outline pills under the reply, named by site. Each is a ui-sdk
// Button rendering a plain link that opens the page in a new tab, without
// telling the site where the visit came from (rel="noopener noreferrer").
// A long site name is cut with an ellipsis; the pills wrap onto more rows.
import { Button } from "@/components/ui/button"
import type { Source } from "@/lib/chat/searches"

export function Sources({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null
  return (
    <nav aria-label="Sources">
      <ul className="flex flex-wrap gap-1.5">
        {sources.map((source) => (
          <li key={source.site} className="max-w-full min-w-0">
            <Button
              variant="outline"
              size="sm"
              className="max-w-full"
              render={
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={source.title}
                  aria-label={source.site}
                />
              }
            >
              <span className="truncate">{source.site}</span>
            </Button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
