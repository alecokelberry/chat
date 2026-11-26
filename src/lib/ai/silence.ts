// The silence limit: model middleware that ends a reply once the model has
// sent nothing for a while, before its first word or between two, so a
// hung NVIDIA shows an error with Retry instead of "Thinking" forever.
// NVIDIA's free API sometimes takes a request and then holds it for
// minutes (on 2026-11-26: five and a half minutes, then a 520; three and
// a half minutes for 11 tokens). The AI SDK's own timeouts don't cover
// it: they end the reply as if Stop were pressed, with no word to the
// person, and the first-chunk one only starts once the response's headers
// arrive, which a hung request never sends.
//
// Each model call starts a timer; every piece of the reply (a word, a
// thought, the stream's start) restarts it. When it runs out, the request
// is cancelled and the call fails with SilentModelError, which the AI SDK
// doesn't retry and src/lib/ai names in the chat. Stop clears the timer.
import type { LanguageModelMiddleware } from "ai"

/** The model sent nothing for the silence limit. */
export class SilentModelError extends Error {
  override name = "SilentModelError"
  constructor(ms: number) {
    super(`The model sent nothing for ${ms / 1000} s`)
  }
}

export function failWhenSilent(ms: number): LanguageModelMiddleware {
  return {
    specificationVersion: "v4",
    wrapStream: async ({ params, model }) => {
      const quiet = new AbortController()
      const abortSignal =
        params.abortSignal === undefined
          ? quiet.signal
          : AbortSignal.any([params.abortSignal, quiet.signal])
      let timer: ReturnType<typeof setTimeout> | undefined
      // Where a silence goes: the waiting call until the stream opens,
      // then the stream.
      let onSilence: (error: SilentModelError) => void = () => {}
      const watch = () => {
        clearTimeout(timer)
        if (abortSignal.aborted) return
        timer = setTimeout(() => {
          const error = new SilentModelError(ms)
          quiet.abort(error)
          onSilence(error)
        }, ms)
      }
      abortSignal.addEventListener("abort", () => clearTimeout(timer), {
        once: true,
      })

      watch()
      const result = await Promise.race([
        model.doStream({ ...params, abortSignal }),
        new Promise<never>((_, reject) => (onSilence = reject)),
      ]).catch((error: unknown) => {
        clearTimeout(timer)
        throw error
      })
      watch()
      return {
        ...result,
        stream: result.stream.pipeThrough(
          new TransformStream({
            start(controller) {
              // The way a provider reports a failure partway: an error
              // part, then the end (an errored stream would skip the
              // chat's error message).
              onSilence = (error) => {
                controller.enqueue({ type: "error", error })
                controller.terminate()
              }
            },
            transform(part, controller) {
              watch()
              controller.enqueue(part)
            },
            flush() {
              clearTimeout(timer)
            },
          })
        ),
      }
    },
  }
}
