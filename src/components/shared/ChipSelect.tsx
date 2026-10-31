interface ChipSelectProps {
  label: string
  options: readonly string[]
  selected: string[]
  onChange: (next: string[]) => void
  /** Allow several values; otherwise acts like a radio group. */
  multiple?: boolean
  hint?: string
}

export function ChipSelect({ label, options, selected, onChange, multiple = false, hint }: ChipSelectProps) {
  function toggle(option: string) {
    if (!multiple) {
      onChange([option])
      return
    }
    onChange(
      selected.includes(option)
        ? selected.filter((value) => value !== option)
        : [...selected, option],
    )
  }

  return (
    <fieldset className="chip-field">
      <legend>
        {label}
        {hint && <span className="hint"> · {hint}</span>}
      </legend>
      <div className="chips">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className="chip"
            aria-pressed={selected.includes(option)}
            onClick={() => toggle(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
