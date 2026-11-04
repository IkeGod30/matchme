import { useRef, useState } from 'react'
import type { Profile } from '../../types'

/**
 * A member's photos in a strip you can swipe, scroll or step through with the arrows. Shown only
 * when they have more than one photo; their main photo is already in the portrait.
 */
export function PhotoCarousel({ profile }: { profile: Profile }) {
  const photos = profile.photos ?? []
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  if (photos.length < 2) return null

  const slides = () => [...(track.current?.children ?? [])] as HTMLElement[]

  function onScroll() {
    const el = track.current
    if (!el) return
    // The photo whose left edge is nearest the strip's scroll position.
    const nearest = slides().reduce(
      (best, slide, i) =>
        Math.abs(slide.offsetLeft - el.scrollLeft) < Math.abs(slides()[best].offsetLeft - el.scrollLeft) ? i : best,
      0,
    )
    // At the far end, the last photo counts as current even if it can't reach the left edge.
    setIndex(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 ? photos.length - 1 : nearest)
  }

  function goTo(i: number) {
    const el = track.current
    const slide = slides()[i]
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (el && slide) el.scrollTo({ left: slide.offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  return (
    <div className="photo-carousel">
      <div
        ref={track}
        className="photo-track"
        tabIndex={0}
        role="region"
        aria-label={`Photos of ${profile.name} (${photos.length})`}
        onScroll={onScroll}
      >
        {photos.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`${profile.name}, photo ${i + 1} of ${photos.length}`}
            loading="lazy"
            draggable={false}
          />
        ))}
      </div>
      <div className="photo-nav">
        <button
          type="button"
          className="btn ghost small-btn"
          aria-label="Previous photo"
          disabled={index === 0}
          onClick={() => goTo(index - 1)}
        >
          ‹
        </button>
        <span className="photo-dots" aria-hidden="true">
          {photos.map((src, i) => (
            <span key={src} data-current={i === index || undefined} />
          ))}
        </span>
        <span className="muted small">
          {index + 1} / {photos.length}
        </span>
        <button
          type="button"
          className="btn ghost small-btn"
          aria-label="Next photo"
          disabled={index === photos.length - 1}
          onClick={() => goTo(index + 1)}
        >
          ›
        </button>
      </div>
    </div>
  )
}
