// The one client for Keenable's API (docs.keenable.ai), shared by web search
// (search.ts) and page reading (read-page.ts): a POST with the
// KEENABLE_API_KEY secret, a timeout joined to the reply's Stop signal, and
// the error for a response that isn't 2xx. `guarded` wraps a tool's call:
// a failure goes to the log (Keenable's status, never the key) and becomes
// a short WebToolError the model reads as the tool's error and the step
// shows. Keenable's 402 means the month's free allowance is used up, and
// the reason says so. A third Keenable tool would reuse both.
import { env } from "cloudflare:workers"

/** Why a web tool found nothing, as the model and the chat read it. */
export class WebToolError extends Error {}

/** Keenable's answer when it isn't a 2xx (402: the month's free
 *  allowance is used up). */
class KeenableError extends Error {
  constructor(readonly status: number) {
    super(`Keenable answered ${status}`)
  }
}

/** POSTs `body` to Keenable's `path` and returns its JSON. */
export async function keenable(
  path: "search" | "fetch",
  body: unknown,
  timeoutMs: number,
  abortSignal: AbortSignal | undefined
): Promise<unknown> {
  const signals = [AbortSignal.timeout(timeoutMs)]
  if (abortSignal !== undefined) signals.push(abortSignal)
  const response = await fetch(`https://api.keenable.ai/v1/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": env.KEENABLE_API_KEY,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.any(signals),
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new KeenableError(response.status)
  }
  return response.json()
}

/** Runs `run`; if it fails (unless Stop did that), logs it and throws a
 *  WebToolError saying `failed`, or `used` when Keenable answered 402. */
export async function guarded<T>(
  what: string,
  messages: { used: string; failed: string },
  abortSignal: AbortSignal | undefined,
  run: () => Promise<T>
): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (abortSignal?.aborted === true) throw error
    console.error(
      `${what} failed:`,
      error instanceof Error ? error.message : String(error)
    )
    throw new WebToolError(
      error instanceof KeenableError && error.status === 402
        ? messages.used
        : messages.failed
    )
  }
}
