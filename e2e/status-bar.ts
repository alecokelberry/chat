// What color iOS 26 gives the status bar and Safari's bottom toolbar,
// worked out in the page the way WebKit does it, so a test can check the
// bars without an iPhone. WebKit (LocalFrameView::fixedContainerEdges,
// Page::updateFixedContainerEdges) colors each from the fixed or sticky
// element at its edge's middle, 4px in (the top edge for the status bar,
// the bottom one for the toolbar), or from the page's background when
// there's none. It looks again
// only when a fixed or sticky element is added or removed, never when colors
// change, and once the edge has a color a full-screen element, a dimming
// backdrop or a side drawer keeps that color instead of taking its own.
// Nothing new is taken while anything in the top layer shows (a popover or
// a modal dialog, wherever it sits), and a strip in the top layer doesn't
// count: measured in the Simulator's Home Screen app on iOS 27.2.
// watchStatusBar installs that model; statusBar and bottomBar read its
// answers.
import type { Page } from "@playwright/test"

declare global {
  interface Window {
    statusBar?: () => string
    bottomBar?: () => string
  }
}

/** Installs the model before the page's own scripts. Each frame it checks
 *  whether the set of fixed and sticky elements changed, and only then
 *  samples the edges again, as WebKit does. */
export async function watchStatusBar(page: Page) {
  await page.addInitScript(() => {
    const NEARLY_TRANSPARENT = 0.1
    const MARGIN = 4
    const THIN = 10

    type Size = "smaller" | "similar" | "larger"
    type Kind =
      | "skip"
      | "hidden"
      | "too-small"
      | "too-large"
      | "viewport"
      | "sidebar"
      | "dimming"
      | "candidate"

    function compare(length: number, viewport: number): Size {
      if (length < viewport * 0.9) return "smaller"
      if (length < viewport * 1.05) return "similar"
      return "larger"
    }

    function visible(color: string) {
      return color !== "" && color !== "transparent" && !/,\s*0\)$/.test(color)
    }

    function alpha(color: string) {
      const match = /rgba\([^)]*,\s*([\d.]+)\)/.exec(color)
      return match ? Number(match[1]) : 1
    }

    function hiddenOrNearlyTransparent(
      el: Element,
      style: CSSStyleDeclaration
    ) {
      if (style.visibility !== "visible") return true
      if (Number(style.opacity) < NEARLY_TRANSPARENT) return true
      const background =
        visible(style.backgroundColor) || style.backgroundImage !== "none"
      return (
        !background &&
        style.backdropFilter === "none" &&
        el.firstChild === null &&
        !(el instanceof HTMLImageElement)
      )
    }

    function sizes(el: Element) {
      const rect = el.getBoundingClientRect()
      const width = Math.min(innerWidth, document.documentElement.clientWidth)
      return {
        rect,
        side: compare(rect.width, width - 2 * MARGIN),
        adjacent: compare(rect.height, innerHeight - 2 * MARGIN),
      }
    }

    function primaryBackground(el: Element) {
      const style = getComputedStyle(el)
      const { rect, side } = sizes(el)
      if (rect.width <= THIN || rect.height <= THIN) return ""
      if (hiddenOrNearlyTransparent(el, style)) return ""
      if (side === "smaller") return ""
      return visible(style.backgroundColor) ? style.backgroundColor : ""
    }

    /** A full-screen layer with no children and a see-through fill. */
    function dimming(el: Element, style: CSSStyleDeclaration) {
      const { side, adjacent } = sizes(el)
      if (side === "smaller" || adjacent === "smaller") return false
      if (!visible(style.backgroundColor) || el.firstChild !== null)
        return false
      const background = primaryBackground(el)
      return (
        Number(style.opacity) < 1 ||
        (background !== "" && alpha(background) < 1)
      )
    }

    const pinned = new Set(["fixed", "sticky"])

    function kind(el: Element): Kind {
      const style = getComputedStyle(el)
      if (!pinned.has(style.position)) return "skip"
      if (hiddenOrNearlyTransparent(el, style)) return "hidden"
      const { side, adjacent } = sizes(el)
      if (side === "smaller")
        return adjacent === "smaller" ? "too-small" : "sidebar"
      if (dimming(el, style)) return "dimming"
      if (adjacent === "larger") return "too-large"
      if (side !== "similar" || adjacent !== "similar") return "candidate"
      return Number(style.zIndex) < 0 ? "hidden" : "viewport"
    }

    type Edge = "top" | "bottom"

    /** The element under an edge's middle, as WebKit's first hit test
     *  finds it: ignoring pointer-events. */
    function hit(side: Edge) {
      const sheet = document.createElement("style")
      sheet.textContent = "* { pointer-events: auto !important }"
      document.head.appendChild(sheet)
      const width = Math.min(innerWidth, document.documentElement.clientWidth)
      const y = side === "top" ? MARGIN : innerHeight - MARGIN
      const el = document.elementFromPoint(width / 2, y)
      sheet.remove()
      return el
    }

    const CONTAINERS: Kind[] = ["viewport", "dimming", "sidebar", "candidate"]

    /** The first fixed or sticky container up from the hit, and the one
     *  background color on the way, if there's only one. */
    function find(side: Edge) {
      const colors = new Set<string>()
      for (let el = hit(side); el !== null; el = el.parentElement) {
        const type = kind(el)
        const own = type === "hidden" ? "" : primaryBackground(el)
        if (own !== "") colors.add(own)
        if (CONTAINERS.includes(type)) {
          const background = colors.size === 1 ? ([...colors][0] ?? "") : ""
          return { el, type, background }
        }
      }
      return null
    }

    function pageBackground() {
      const html = getComputedStyle(document.documentElement).backgroundColor
      return visible(html)
        ? html
        : getComputedStyle(document.body).backgroundColor
    }

    const edges: Record<Edge, { color: string; el: Element } | null> = {
      top: null,
      bottom: null,
    }
    let fixed = new Set<Element>()

    /** Whether something in the top layer is drawn and visible. */
    function topLayerShows() {
      return [...document.querySelectorAll(":popover-open, dialog:modal")].some(
        (el) =>
          el.getClientRects().length > 0 &&
          getComputedStyle(el).visibility === "visible"
      )
    }

    function sample(side: Edge) {
      const edge = edges[side]
      const found = find(side)
      if (!found) {
        // Page::updateFixedContainerEdges keeps the last element's color
        // while it's still drawn and visible.
        const last = edge?.el
        const kept =
          last !== undefined &&
          last.isConnected &&
          last.getClientRects().length > 0 &&
          getComputedStyle(last).visibility === "visible"
        if (!kept) edges[side] = null
        return
      }
      const prefersExisting = found.type !== "candidate"
      if (prefersExisting && edge) {
        edges[side] = { color: edge.color, el: found.el }
        return
      }
      // A transparent edge falls back to a snapshot of its pixels; here,
      // the color of the element under the point.
      const color = found.background === "" ? "snapshot" : found.background
      edges[side] = { color, el: found.el }
    }

    function fixedSet() {
      const next = new Set<Element>()
      for (const el of document.querySelectorAll("*")) {
        const { position } = getComputedStyle(el)
        if (pinned.has(position) && el.getClientRects().length > 0) next.add(el)
      }
      return next
    }

    function tick() {
      const next = fixedSet()
      const changed =
        next.size !== fixed.size || [...next].some((el) => !fixed.has(el))
      fixed = next
      if (changed && !topLayerShows()) {
        sample("top")
        sample("bottom")
      }
      requestAnimationFrame(tick)
    }
    addEventListener("DOMContentLoaded", () => requestAnimationFrame(tick))

    window.statusBar = () => edges.top?.color ?? pageBackground()
    window.bottomBar = () => edges.bottom?.color ?? pageBackground()
  })
}

/** The status bar's color now, as rgb(). */
export function statusBar(page: Page) {
  return page.evaluate(() => window.statusBar?.() ?? "")
}

/** Safari's bottom toolbar's color now, as rgb(). */
export function bottomBar(page: Page) {
  return page.evaluate(() => window.bottomBar?.() ?? "")
}
