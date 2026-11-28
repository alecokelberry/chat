// When a private chat's agent (src/lib/chat/agent.ts) wipes itself: its
// alarm checks every PRIVATE_CHECK_EVERY seconds, and it ends the chat once
// no socket is open and the last close (kept in storage) is at least
// PRIVATE_GRACE old, so a dropped socket has time to reconnect. A chat
// whose close was never heard (an evicted object) has no close time, so
// the first check with no socket ends it.

/** Seconds between a private chat's checks for an open page. */
export const PRIVATE_CHECK_EVERY = 60

/** Milliseconds a private chat waits after a socket closes for a
 *  reconnect before it may wipe itself. */
export const PRIVATE_GRACE = 30_000

/** Whether a private chat's page is gone for good. */
export const privateChatLeft = (
  open: boolean,
  lastClose: number | undefined,
  now: number
) => !open && now - (lastClose ?? 0) >= PRIVATE_GRACE
