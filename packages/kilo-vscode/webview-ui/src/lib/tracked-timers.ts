/**
 * useTrackedTimers — Solid hook that gives a component a setTimeout/setInterval
 * helper which automatically clears every pending handle on unmount.
 *
 * Background (Wave 10 audit): Many settings tabs in the webview do something
 * like:
 *
 *   const onClick = () => {
 *     setLoading(true)
 *     setTimeout(() => setLoading(false), 4000)   // <— BAD
 *   }
 *
 * If the user switches Settings tabs (or closes the panel) before the timer
 * fires, the callback still runs — calling `setLoading` on a now-disposed
 * Solid signal. This warns in dev, but more importantly it pins the
 * component's entire reactive scope (and the closures inside the callback)
 * in memory until the timer fires. Across many clicks this accumulates and
 * was a likely contributor to the cumulative tab-click freeze.
 *
 * The exemplar fix (HermesTab.tsx:108-115, AgentBackendsTab.tsx:365-377,
 * RoutingTab.tsx:360-372) used a local `pendingTimers: Set` plus inline
 * onCleanup. This module extracts that pattern so the seven additional
 * affected tabs can be fixed without copy-pasting boilerplate.
 *
 * IMPORTANT: like all Solid hooks that use `onCleanup`, this MUST be called
 * inside a reactive owner (component body, createRoot, createEffect). Calling
 * it inside a plain event handler is a no-op for the cleanup — the cleanup
 * never registers and timers will leak. Use it at the top of a component
 * function, not inside `onClick`.
 */

import { onCleanup } from "solid-js"

export interface TrackedTimers {
	/** Schedule a one-shot timeout that auto-cancels on unmount. */
	trackTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
	/** Schedule a repeating interval that auto-cancels on unmount. */
	trackInterval: (fn: () => void, ms: number) => ReturnType<typeof setInterval>
	/** Clear a specific tracked timeout early. Safe to call after auto-cancel. */
	cancelTimeout: (handle: ReturnType<typeof setTimeout>) => void
	/** Clear a specific tracked interval early. Safe to call after auto-cancel. */
	cancelInterval: (handle: ReturnType<typeof setInterval>) => void
	/** Clear all pending timeouts + intervals immediately. */
	cancelAll: () => void
}

export function useTrackedTimers(): TrackedTimers {
	const timeouts = new Set<ReturnType<typeof setTimeout>>()
	const intervals = new Set<ReturnType<typeof setInterval>>()

	const trackTimeout = (fn: () => void, ms: number) => {
		const handle = setTimeout(() => {
			timeouts.delete(handle)
			fn()
		}, ms)
		timeouts.add(handle)
		return handle
	}

	const trackInterval = (fn: () => void, ms: number) => {
		const handle = setInterval(fn, ms)
		intervals.add(handle)
		return handle
	}

	const cancelTimeout = (handle: ReturnType<typeof setTimeout>) => {
		if (timeouts.delete(handle)) clearTimeout(handle)
	}

	const cancelInterval = (handle: ReturnType<typeof setInterval>) => {
		if (intervals.delete(handle)) clearInterval(handle)
	}

	const cancelAll = () => {
		for (const t of timeouts) clearTimeout(t)
		for (const i of intervals) clearInterval(i)
		timeouts.clear()
		intervals.clear()
	}

	onCleanup(cancelAll)

	return { trackTimeout, trackInterval, cancelTimeout, cancelInterval, cancelAll }
}
