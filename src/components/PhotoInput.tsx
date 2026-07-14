import { useEffect, useRef, useState } from 'react'
import type { PhotoKind } from '../db/db'
import { compressPhoto } from '../lib/image'

interface Props {
  kind: PhotoKind
  label: string
  blob?: Blob
  onCapture: (kind: PhotoKind, blob: Blob) => void
  onRemove?: (kind: PhotoKind) => void
}

export function PhotoInput({ kind, label, blob, onCapture, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState<string>()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!blob) { setUrl(undefined); return }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      onCapture(kind, await compressPhoto(file, kind))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="photo">
      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} hidden />
      {url ? (
        <div className="photo-preview">
          <img src={url} alt={label} />
          <div className="photo-actions">
            <button type="button" className="chip" onClick={() => inputRef.current?.click()}>Přefotit</button>
            {onRemove && <button type="button" className="chip danger" onClick={() => onRemove(kind)}>Smazat</button>}
          </div>
        </div>
      ) : (
        <button type="button" className="photo-btn" onClick={() => inputRef.current?.click()} disabled={busy}>
          <span className="photo-icon">{busy ? '⏳' : '📷'}</span>
          <span>{busy ? 'Zpracovávám…' : label}</span>
        </button>
      )}
    </div>
  )
}
