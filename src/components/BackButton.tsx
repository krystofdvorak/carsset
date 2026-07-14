interface Props {
  onClick: () => void
}

export function BackButton({ onClick }: Props) {
  return (
    <button className="back-btn" onClick={onClick} aria-label="Zpět">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
