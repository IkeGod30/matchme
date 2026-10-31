import { optionNote, type BodyFeature } from '../../data/attributes'
import { FeatureImage } from './FeatureImage'
import type { FigureSex } from './silhouettes'

interface FeaturePickerProps {
  feature: BodyFeature
  selected: string[]
  onChange: (next: string[]) => void
  /** Multi-select with a "No preference" card (partner wizard) vs. single choice (self-description). */
  multiple?: boolean
  label?: string
  /** Body drawn for height and body-type pictures. */
  figure?: FigureSex
}

export function FeaturePicker({ feature, selected, onChange, multiple = false, label, figure }: FeaturePickerProps) {
  function toggle(option: string) {
    if (!multiple) return onChange([option])
    onChange(selected.includes(option) ? selected.filter((v) => v !== option) : [...selected, option])
  }

  return (
    <fieldset className="pic-field">
      {label && <legend>{label}</legend>}
      <div className="pic-grid">
        {multiple && (
          <button
            type="button"
            className="pic-option no-pref"
            aria-pressed={selected.length === 0}
            onClick={() => onChange([])}
          >
            <span className="no-pref-mark" aria-hidden="true">
              ∗
            </span>
            <span className="pic-label">No preference</span>
            <span className="pic-note">Any is fine</span>
          </button>
        )}
        {feature.options.map((option) => {
          const note = optionNote(feature.key, option)
          return (
            <button
              key={option}
              type="button"
              className="pic-option"
              aria-pressed={selected.includes(option)}
              onClick={() => toggle(option)}
            >
              <FeatureImage feature={feature.key} option={option} figure={figure} />
              <span className="pic-label">{option}</span>
              {note && <span className="pic-note">{note}</span>}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
