export const fmtCZK = (n: number) =>
  new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0,
  }).format(n)

export function fmtDateTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function contractNumber(countThisYear: number, year: number): string {
  return `${year}-${String(countThisYear + 1).padStart(4, '0')}`
}

export const carEmoji = (type: 'osobni' | 'dodavka') => (type === 'dodavka' ? '🚐' : '🏎️')
