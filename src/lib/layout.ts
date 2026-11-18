import { useEffect, useRef } from 'react'

/** Matches the CSS breakpoint where list/detail layouts (.mm-layout) stack into one column. */
const STACKED = '(max-width: 960px)'

/**
 * On narrow screens a list sits above its detail panel, so picking an item would leave the
 * detail out of sight. Returns a ref for the detail panel; whenever `selectedKey` changes to a
 * value, the panel is scrolled into view (only when the layout is stacked).
 */
export function useRevealOnNarrow<T extends HTMLElement>(selectedKey: unknown) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (selectedKey == null || !window.matchMedia(STACKED).matches) return
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ref.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
  }, [selectedKey])
  return ref
}
