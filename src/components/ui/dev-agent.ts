// The ui-sdk agent bridge, in dev only: window.agent.snapshot() lists every
// control with its state, and window.agent.act() drives them, so Claude can
// check a screen without clicking through it. Imported by __root before the
// app renders, since the bridge only sees components mounted after it.
import { createAgent } from "@ui-sdk/react/agent"

if (import.meta.env.DEV && typeof window !== "undefined") {
  // No allow: a step on data-agent-confirm fails and stays a person's.
  Object.assign(window, { agent: createAgent() })
}
