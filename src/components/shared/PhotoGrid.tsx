import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'

/**
 * A member's photos as small thumbnails; tapping one opens it full size, with arrows to step
 * through the rest. Shows nothing when the member has no photos.
 */
export function PhotoGrid({ photos, name }: { photos: string[]; name: string }) {
  const [open, setOpen] = useState<number | null>(null)
  if (photos.length === 0) return null

  return (
    <div className="photo-thumbs-section">
      <span className="criteria-title">Photos</span>
      <ul className="photo-thumbs">
        {photos.map((src, i) => (
          <li key={src}>
            <button type="button" onClick={() => setOpen(i)} aria-label={`View photo ${i + 1} of ${photos.length} of ${name}`}>
              <img src={src} alt="" width={72} height={72} loading="lazy" decoding="async" />
            </button>
          </li>
        ))}
      </ul>
      {open !== null && (
        <PhotoViewer photos={photos} name={name} start={open} onClose={() => setOpen(null)} />
      )}
    </div>
  )
}

function PhotoViewer({ photos, name, start, onClose }: { photos: string[]; name: string; start: number; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [index, setIndex] = useState(start)
  const count = photos.length
  const step = (by: number) => setIndex((i) => (i + by + count) % count)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowRight') step(1)
    else if (event.key === 'ArrowLeft') step(-1)
  }

  // A tap on the dimmed backdrop (the dialog element itself, outside its content) closes it.
  function onClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) dialogRef.current.close()
  }

  return (
    <dialog
      ref={dialogRef}
      className="photo-viewer"
      aria-label={`Photos of ${name}`}
      onClose={onClose}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      <img src={photos[index]} alt={`Photo ${index + 1} of ${count} of ${name}`} />
      <div className="photo-viewer-bar">
        {count > 1 && (
          <button type="button" className="btn ghost small-btn" onClick={() => step(-1)} aria-label="Previous photo">
            ‹
          </button>
        )}
        <span className="muted small" aria-live="polite">
          {index + 1} / {count}
        </span>
        {count > 1 && (
          <button type="button" className="btn ghost small-btn" onClick={() => step(1)} aria-label="Next photo">
            ›
          </button>
        )}
        <button type="button" className="btn primary small-btn" onClick={() => dialogRef.current?.close()} autoFocus>
          Close
        </button>
      </div>
    </dialog>
  )
}
