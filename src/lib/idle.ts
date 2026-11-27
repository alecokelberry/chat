// Runs work once the browser is idle, so a first use (opening a chat, the
// first code block) finds it ready instead of loading it on the spot:
// requestIdleCallback where there is one, else a short timeout. Returns
// its cancel.
export function whenIdle(work: () => void, timeout = 2000) {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(work, { timeout })
    return () => cancelIdleCallback(id)
  }
  const id = setTimeout(work, 300)
  return () => clearTimeout(id)
}
