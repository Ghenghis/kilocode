/**
 * Module-level draft storage for PromptInput.
 *
 * Per-session input text/review-comment/image-attachment drafts survive
 * remounts because the Maps live at module scope. Without caps these would
 * grow unbounded as sessions are created and never cleared (drafts only
 * delete when the user sends or the session is reloaded into the input).
 *
 * Wave 2 audit fix:
 *   - Caps each Map to a maximum size; oldest entries (Map insertion order)
 *     are evicted in batches of `EVICT_BATCH` to amortize the cost.
 *   - `pruneDraftsForSession` is called on `sessionDeleted` events so closed
 *     sessions never linger as draft entries.
 *
 * NOTE: `imageDrafts` is capped lower than text drafts because image data
 *       URLs can be hundreds of KB each.
 */

import type { ImageAttachment } from "../../hooks/useImageAttachments"
import type { ReviewComment } from "../../types/messages"

/** Maximum number of text-draft entries before eviction kicks in. */
export const MAX_DRAFTS = 250
/** Maximum number of review-comment draft entries before eviction. */
export const MAX_REVIEW_DRAFTS = 250
/** Image drafts hold larger data URLs — keep this cap lower than text drafts. */
export const MAX_IMAGE_DRAFTS = 50
/** When over cap, evict this many oldest entries at once (amortized cleanup). */
export const EVICT_BATCH = 50

/** Per-session text input drafts (key → text). Module-level so it survives remounts. */
export const drafts = new Map<string, string>()
/** Per-session review-comment drafts. */
export const reviewDrafts = new Map<string, ReviewComment[]>()
/** Per-session image-attachment drafts. */
export const imageDrafts = new Map<string, ImageAttachment[]>()

/**
 * Evict oldest entries from `map` if it has grown beyond `cap`.
 * Removes `EVICT_BATCH` entries at once so this isn't called on every set.
 *
 * Returns the number of entries evicted (0 if no-op).
 */
export function enforceDraftCap<V>(map: Map<string, V>, cap: number): number {
  if (map.size <= cap) return 0
  let removed = 0
  // Map iteration order = insertion order. Re-setting an existing key does NOT
  // move it to the end; callers wanting LRU semantics should delete-then-set.
  for (const key of map.keys()) {
    if (removed >= EVICT_BATCH) break
    map.delete(key)
    removed++
  }
  return removed
}

/**
 * Remove every draft entry whose key references the given session ID.
 *
 * Draft keys take the form `<box>:session:<id>` (see `scopeDraftKey` /
 * `sessionDraftKey` in `utils/prompt-drafts.ts`). We match on `:session:<id>`
 * to avoid colliding with `pending:<id>` keys that share the same UUID space.
 *
 * Returns the total number of entries deleted across all three maps.
 */
export function pruneDraftsForSession(sessionId: string): number {
  if (!sessionId) return 0
  const needle = `:session:${sessionId}`
  let removed = 0
  for (const map of [drafts, reviewDrafts, imageDrafts] as Map<string, unknown>[]) {
    for (const key of [...map.keys()]) {
      if (key.includes(needle)) {
        map.delete(key)
        removed++
      }
    }
  }
  return removed
}

/** Test-only handle. Production code should import the named exports above. */
export const __test = {
  drafts,
  reviewDrafts,
  imageDrafts,
  enforceDraftCap,
  pruneDraftsForSession,
  MAX_DRAFTS,
  MAX_REVIEW_DRAFTS,
  MAX_IMAGE_DRAFTS,
  EVICT_BATCH,
}
