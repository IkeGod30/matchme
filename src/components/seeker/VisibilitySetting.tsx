import { useId } from 'react'

const PUBLIC_FIELDS =['Photo', 'First name and age', 'City', 'Job', 'About me', '“Looking for” message']

interface VisibilitySettingProps {
  isPublic: boolean
  onChange: (isPublic: boolean) => void
}

/** Private-by-default choice between a confidential profile and an opt-in public listing. */
export function VisibilitySetting({ isPublic, onChange }: VisibilitySettingProps) {
  const name = useId()

  function choose(next: boolean) {
    if (next === isPublic) return
    if (
      next &&
      !confirm(
        `Feature your profile publicly?\n\nAnyone visiting MatchMe will see: ${PUBLIC_FIELDS.join(', ')}.\n\nYour body details, preferences, race and nationality stay private. You can switch back to private at any time.`,
      )
    ) {
      return
    }
    onChange(next)
  }

  return (
    <fieldset className="visibility">
      <legend>Profile visibility</legend>
      <label className="visibility-option" data-checked={!isPublic || undefined}>
        <input type="radio" name={name} checked={!isPublic} onChange={() => choose(false)} />
        <span>
          <strong>Private and confidential</strong> <span className="badge">Recommended</span>
          <span className="muted small">
            Only you, your matchmaker and the people you’re matched with can see your profile.
          </span>
        </span>
      </label>
      <label className="visibility-option" data-checked={isPublic || undefined}>
        <input type="radio" name={name} checked={isPublic} onChange={() => choose(true)} />
        <span>
          <strong>Feature me publicly</strong>
          <span className="muted small">
            Show a public card on the Featured members page: {PUBLIC_FIELDS.join(', ').toLowerCase()}. Body details,
            preferences, race and nationality always stay private.
          </span>
        </span>
      </label>
    </fieldset>
  )
}
