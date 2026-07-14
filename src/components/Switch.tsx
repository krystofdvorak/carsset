interface Props {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  sub?: string
}

export function Switch({ checked, onChange, label, sub }: Props) {
  return (
    <div className="switch-row">
      <div>
        <div className="s-label">{label}</div>
        {sub && <div className="s-sub">{sub}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`switch ${checked ? 'on' : ''}`}
        onClick={() => onChange(!checked)}
      />
    </div>
  )
}
