# NVIDIA models

What the free NVIDIA API gives me and how the models Chat uses behave. Re-check before relying on a fact: `GET https://integrate.api.nvidia.com/v1/models` lists ids without auth, but listed doesn't mean reachable. The archived Chat's `docs/nvidia.md` has the rest (embeddings, speech, images, retired and too-slow models).

## Free plan

| Topic                               | Today                                                                                                                                                     | Source                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Who                                 | Anyone in the free NVIDIA Developer Program, for as long as you're a member                                                                               | [NIM FAQ](https://docs.api.nvidia.com/nim/docs/product) (2026-08-06)                                                  |
| Credits                             | Gone: replaced by rate limits, no time limit                                                                                                              | NVIDIA staff on the forum, 2025-09                                                                                    |
| Rate limit                          | Not published. About 40 requests/min per account (community reports). Depends on model and load; no way to raise it on the free tier                      | forum, 2026-09                                                                                                        |
| Tokens/min, concurrency, daily caps | Not published                                                                                                                                             |                                                                                                                       |
| Allowed use                         | "Limited trial purposes", not production (ToS §1.2)                                                                                                       | [Trial ToS](https://assets.ngc.nvidia.com/products/api-catalog/legal/NVIDIA%20API%20Trial%20Terms%20of%20Service.pdf) |
| Data                                | Not stored after the session, but may be logged for abuse monitoring (§2.3, 2.4, 2.7). Don't send health, payment or other sensitive personal data (§2.6) | Trial ToS                                                                                                             |

## Errors

| Status                                                                        | Meaning                             | App does                                                                                                             |
| ----------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 429 `{"status":429,"title":"Too Many Requests"}`                              | Our rate limit                      | One retry after 2 s, then an error in the chat with Retry. No `retry-after` or `x-ratelimit-*` headers are ever sent |
| 503 `ResourceExhausted: Worker local total request limit reached`             | Shared capacity is full             | One retry after 2 s, then an error in the chat with Retry. Never another model                                       |
| Nothing at all, for minutes (Nov 26: 5.5 min then a 520; 2 min for 10 tokens) | NVIDIA hung                         | After 30 s with nothing, before the first word or between two, an error in the chat with Retry. No automatic retry   |
| 410 Gone (end-of-life date in `detail`)                                       | Model retired                       | Drop it from the map                                                                                                 |
| 404 "Function … Not found for account"                                        | Listed but not available to our key | Don't offer it                                                                                                       |
| 400 "did not match any variant of … UserMessageContent"                       | PDF sent as a `file` part           | Send PDFs as text or page images; images go as `image_url` data URLs                                                 |

## Models

Measured 2026-11-21 with real calls (first token streamed, thinking off). Chat's lineup: **Super** (default, reads images), **Ultra** (thinks hard), **Nano Omni** (images, audio, video), **Lightning** (fastest).

| Model id                                        | What                                    | Thinking off                                  | First token | Tools | Images | Notes                                                                                          |
| ----------------------------------------------- | --------------------------------------- | --------------------------------------------- | ----------- | ----- | ------ | ---------------------------------------------------------------------------------------------- |
| `nvidia/nemotron-3.5-super-vl-120b-a12b`        | 120B (12B active), 1M, text/image/video | `chat_template_kwargs.enable_thinking: false` | 0.4s        | yes   | yes    | Chat's default since Nov 21. Thinks by default. Answers with id `nemotron-3.5-super-120b-a12b` |
| `nvidia/nemotron-3.5-lightning-30b-a3b`         | 30B (3B active), 1M                     | same                                          | 0.16s       | yes   | no     | Fastest. Lookups were hit and miss with thinking off (Oct)                                     |
| `nvidia/nemotron-3-ultra-550b-a55b`             | 550B (55B active), 1M                   | same                                          | 0.8–0.9s    | yes   | no     | Chat's "think hard" model                                                                      |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | 31B (3B active), 256K, also audio/video | same                                          | 0.17s       | yes   | yes    | Images now also go to Super                                                                    |

Added 2026-11-28 from the public catalog, **not yet called with our key** (first token, tools, thinking switch and image input are unmeasured; the picker sends no chat template for them):

| Model id                            | What                                                 | Images |
| ----------------------------------- | ---------------------------------------------------- | ------ |
| `moonshotai/kimi-k3.1-pro`          | ~3T, 1M, agentic coding, thinking, tools             | yes    |
| `mistralai/mistral-large-4-1t-a52b` | 1T (52B active), reasoning, tools, structured output | yes    |

Looked at and left out: `z-ai/glm-5.3-flash` (no thinking off switch), `nvidia/nemotron-3.5-bolt-e4b` (Lightning covers fast), MiniMax M3.1 Flash, Step 5 Preview. Image generation (FLUX 3 Klein) and speech (Parakeet, `nemotron-transcribe`) have no free hosted endpoint; the forum reports 404 "Function not found for account" for hosted image models on the free tier. `nvidia/nemotron-3.5-embed-1b` is the pick if semantic search ever happens.

## Request quirks

- Every model streams reasoning in `delta.reasoning_content` (gpt-oss also sends `delta.reasoning`); `@ai-sdk/openai-compatible` reads either.
- The model map records how each model thinks: `enable_thinking` or `thinking`. Effort-only models (GLM, gpt-oss) have no off switch, so the app doesn't offer them.
- Reasoning uses the `max_tokens` budget: keep it generous or the answer never starts.
- Unverified: GLM's `clear_thinking: true`, Nemotron Ultra's `force_nonempty_content: true` for tool calls with thinking on, and any quality ranking (none were benchmarked).
