import { useRef } from 'react'

interface Props {
  label: string
  value: string
  onChange: (v: string) => void
}

/** Datum a čas – klik kamkoliv otevře nativní (tmavý) kalendář, ruční psaní zakázané. */
export function DateTimeField({ label, value, onChange }: Props) {
  const ref = useRef<HTMLInputElement>(null)

  function openPicker() {
    const el = ref.current as (HTMLInputElement & { showPicker?: () => void }) | null
    try {
      el?.showPicker?.()
    } catch {
      /* showPicker může selhat mimo gesto – ignoruj */
    }
  }

  return (
    <div className="field">
      <label>{label}</label>
      <input
        ref={ref}
        type="datetime-local"
        className="dt-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.preventDefault()}
        onClick={openPicker}
        readOnly={false}
      />
    </div>
  )
}
