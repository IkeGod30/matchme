import { useId, useState, type KeyboardEvent } from 'react'

interface TagInputProps {
  label: string
  values: string[]
  onChange: (next: string[]) => void
  suggestions?: string[]
  placeholder?: string
  hint?: string
}

export function TagInput({ label, values, onChange, suggestions = [], placeholder, hint }: TagInputProps) {
  const [text, setText] = useState('')
  const listId = useId()
  const inputId = useId()

  function add() {
    const value = text.trim().replace(/,$/, '')
    if (value && !values.some((v) => v.toLowerCase() === value.toLowerCase())) onChange([...values, value])
    setText('')
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      add()
    } else if (event.key === 'Backspace' && !text && values.length) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div className="field">
      <label htmlFor={inputId}>
        {label}
        {hint && <span className="hint"> · {hint}</span>}
      </label>
      <div className="tag-input">
        {values.map((value) => (
          <span key={value} className="tag">
            {value}
            <button type="button" aria-label={`Remove ${value}`} onClick={() => onChange(values.filter((v) => v !== value))}>
              ×
            </button>
          </span>
        ))}
        <input
          id={inputId}
          list={listId}
          value={text}
          placeholder={values.length ? '' : placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={add}
        />
      </div>
      <datalist id={listId}>
        {suggestions
          .filter((s) => !values.includes(s))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  )
}
