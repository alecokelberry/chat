// "Skip to content": the first Tab stop on every signed-in page, past the
// sidebar. Hidden until it has keyboard focus, then a pill at the top left.
// It's a link to #main (each page's <main>, focusable with tabIndex -1),
// and moves focus there itself, so the address keeps no #main. absolute
// replaces Button's relative, which would put the hidden link in the flow.
import type * as React from "react"

import { Button } from "@/components/ui/button"

function SkipLink() {
  function skip(event: React.MouseEvent) {
    const main = document.getElementById("main")
    if (main === null) return
    event.preventDefault()
    main.focus()
  }
  return (
    <Button
      // oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- Button renders its children into the link
      render={<a href="#main" />}
      onClick={skip}
      size="sm"
      className="sr-only absolute bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:not-sr-only focus-visible:fixed focus-visible:start-3 focus-visible:top-3 focus-visible:z-50 focus-visible:h-8 focus-visible:px-3 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      Skip to content
    </Button>
  )
}

export { SkipLink }
