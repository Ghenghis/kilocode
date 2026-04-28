/**
 * createFocusTrap — Accessibility utility for KiloCode canary.10
 *
 * When called inside an onMount / createEffect, wraps the given container
 * element so that:
 *  - Tab cycles through focusable children (wraps at both ends)
 *  - Shift+Tab cycles in reverse
 *  - Focus is moved into the container immediately on activation
 *  - The element that had focus before activation is restored on deactivation
 *  - Background content receives aria-hidden="true" while the trap is active
 *
 * Returns a `deactivate()` function; call it from onCleanup or when the
 * modal closes.
 *
 * Usage:
 *   onMount(() => {
 *     const trap = createFocusTrap(containerEl, { returnFocus: triggerEl })
 *     onCleanup(() => trap.deactivate())
 *   })
 */

const FOCUSABLE_SELECTORS = [
  "a[href]",
  "area[href]",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  "details > summary",
].join(", ")

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)).filter(
    (el) => !el.closest("[inert]") && el.offsetParent !== null,
  )
}

export interface FocusTrapOptions {
  /**
   * Element to return focus to when the trap is deactivated.
   * Defaults to `document.activeElement` captured at activation time.
   */
  returnFocus?: HTMLElement | null
  /**
   * When true, sibling elements of the container that are direct children of
   * `document.body` will have `aria-hidden="true"` applied while the trap is
   * active, hiding background content from screen readers.
   * Defaults to true.
   */
  hideBackground?: boolean
}

export interface FocusTrap {
  deactivate: () => void
}

export function createFocusTrap(
  container: HTMLElement,
  options: FocusTrapOptions = {},
): FocusTrap {
  const { hideBackground = true } = options

  // Determine element to return focus to on deactivation
  const returnFocusEl: HTMLElement | null =
    options.returnFocus !== undefined
      ? options.returnFocus
      : (document.activeElement as HTMLElement | null)

  // Move focus into the container
  const first = getFocusable(container)[0]
  if (first) {
    first.focus()
  } else {
    // Make the container itself focusable as a fallback
    if (!container.hasAttribute("tabindex")) container.setAttribute("tabindex", "-1")
    container.focus()
  }

  // Track which background siblings we hide so we can restore them
  const hiddenSiblings: Array<{ el: HTMLElement; prevValue: string | null }> = []

  if (hideBackground) {
    const parent = container.parentElement ?? document.body
    const siblings = Array.from(parent.children) as HTMLElement[]
    for (const sibling of siblings) {
      if (sibling === container) continue
      // Don't touch elements that are already hidden from AT
      if (sibling.getAttribute("aria-hidden") === "true") continue
      hiddenSiblings.push({ el: sibling, prevValue: sibling.getAttribute("aria-hidden") })
      sibling.setAttribute("aria-hidden", "true")
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return

    const focusable = getFocusable(container)
    if (focusable.length === 0) {
      e.preventDefault()
      return
    }

    const firstEl = focusable[0]!
    const lastEl = focusable[focusable.length - 1]!

    if (e.shiftKey) {
      // Shift+Tab: move backward
      if (document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      }
    } else {
      // Tab: move forward
      if (document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }
  }

  container.addEventListener("keydown", handleKeyDown)

  const deactivate = () => {
    container.removeEventListener("keydown", handleKeyDown)

    // Restore aria-hidden on background siblings
    for (const { el, prevValue } of hiddenSiblings) {
      if (prevValue === null) {
        el.removeAttribute("aria-hidden")
      } else {
        el.setAttribute("aria-hidden", prevValue)
      }
    }
    hiddenSiblings.length = 0

    // Restore focus to the element that had it before the trap was activated
    try {
      returnFocusEl?.focus?.()
    } catch {
      // Ignore — element may have been removed from the DOM
    }
  }

  return { deactivate }
}
