import { wrapLanguageModel } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { failWhenSilent, SilentModelError } from "@/lib/ai/silence"

// The silence limit through the AI SDK's own seam: a mock model wrapped
// with the middleware, as src/lib/ai wraps NVIDIA's, on fake timers, so
// a minute of silence takes no time.
const LIMIT = 30_000

type Part = { type: "text-delta"; id: string; delta: string }

/** A model whose call answers when `open` is called, with a stream the
 *  test writes to and ends, even after Stop, as a provider that's slow to
 *  notice the abort does. */
function controlledModel() {
  let open = () => {}
  let stream!: ReadableStreamDefaultController<Part>
  const opened = new Promise<void>((resolve) => (open = resolve))
  const model = new MockLanguageModelV4({
    doStream: async () => {
      await opened
      return {
        stream: new ReadableStream<Part>({
          start(controller) {
            stream = controller
          },
        }),
      }
    },
  })
  const word = (delta: string) =>
    stream.enqueue({ type: "text-delta", id: "1", delta })
  return { model, open, word, end: () => stream.close() }
}

function call(model: MockLanguageModelV4, abortSignal?: AbortSignal) {
  return wrapLanguageModel({
    model,
    middleware: failWhenSilent(LIMIT),
  }).doStream({ prompt: [], abortSignal })
}

/** Everything the stream sends until it ends. */
async function readAll(stream: ReadableStream<unknown>) {
  const parts: unknown[] = []
  for await (const part of stream) parts.push(part)
  return parts
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe("failWhenSilent", () => {
  test("fails a call that never answers once the limit passes", async () => {
    const { model } = controlledModel()
    const result = Promise.resolve(call(model)).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(LIMIT)
    expect(await result).toBeInstanceOf(SilentModelError)
  })

  test("keeps waiting while the limit hasn't passed", async () => {
    const { model, open } = controlledModel()
    const result = call(model)
    await vi.advanceTimersByTimeAsync(LIMIT - 1)
    open()
    await expect(result).resolves.toHaveProperty("stream")
  })

  test("ends a stream that goes quiet partway with an error part", async () => {
    const { model, open, word } = controlledModel()
    open()
    const { stream } = await call(model)
    word("Hello")
    const parts = readAll(stream)
    await vi.advanceTimersByTimeAsync(LIMIT)
    const sent = await parts
    expect(sent[0]).toMatchObject({ delta: "Hello" })
    expect(sent.at(-1)).toEqual({
      type: "error",
      error: expect.any(SilentModelError),
    })
  })

  test("lets a slow but steady stream finish: each word restarts the wait", async () => {
    const { model, open, word, end } = controlledModel()
    open()
    const { stream } = await call(model)
    const parts = readAll(stream)
    for (const delta of ["one", "two", "three", "four"]) {
      await vi.advanceTimersByTimeAsync(LIMIT - 1)
      word(delta)
    }
    end()
    expect(await parts).toEqual(
      ["one", "two", "three", "four"].map((delta) =>
        expect.objectContaining({ delta })
      )
    )
  })

  test("raises no silence after Stop", async () => {
    const { model, open, end } = controlledModel()
    open()
    const stop = new AbortController()
    const { stream } = await call(model, stop.signal)
    const parts = readAll(stream)
    stop.abort()
    await vi.advanceTimersByTimeAsync(LIMIT * 2)
    end()
    expect(await parts).toEqual([])
  })
})
